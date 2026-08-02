import 'server-only';

import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { auditDocument, documentStorage, DocumentError } from './document-core';
import { dequeueDocumentAnalysisJobSafely, enqueueDocumentAnalysisJob } from './document-analysis-queue';
import { createConversationTask } from '@/services/conversation-tasks';
import type { ConversationTaskAction, ConversationTaskPriority } from '@/services/conversation-tasks';

export type DocumentClassificationType =
  | 'CONTRACT_SOCIAL' | 'FINANCING_CONTRACT' | 'LOAN_CONTRACT' | 'INVOICE' | 'RECEIPT'
  | 'PAYMENT_PROOF' | 'TAX_DOCUMENT' | 'PERSONAL_DOCUMENT' | 'LEGAL_DOCUMENT' | 'OTHER';

/**
 * O que o documento parece exigir, segundo a IA — não confundir com
 * DocumentAction (decideDocumentAction), que é a decisão final já resolvida.
 * ARCHIVE_ONLY/EXTRACT_INFORMATION nunca geram proposta financeira.
 * FINANCIAL_ACTION_REQUIRED só vira proposta de fato quando
 * isFinancialInstallmentProposal confirma dados mínimos de crédito; caso
 * contrário cai em ASK_USER. REVIEW_REQUIRED (texto ausente/ilegível) sempre
 * cai em ASK_USER — nunca assume.
 */
export type DocumentIntent = 'ARCHIVE_ONLY' | 'EXTRACT_INFORMATION' | 'FINANCIAL_ACTION_REQUIRED' | 'REVIEW_REQUIRED';

export type DocumentEntities = { company: string | null; people: string[]; dates: string[]; amounts: number[] };
export type DocumentFinancialOperation = { detected: boolean; type: string | null; creditor: string | null; amount: number | null; installments: number | null };

export type ContractPreview = {
  documentType: DocumentClassificationType;
  documentIntent: DocumentIntent;
  confidence: 'high' | 'medium' | 'low';
  summary: string;
  entities: DocumentEntities;
  financialOperation: DocumentFinancialOperation;
  suggestedActions: string[];
  // Campos financeiros flat — MANTIDOS DE PROPÓSITO fora de financialOperation.
  // app/api/documents/proposals/[id]/confirm/route.ts lê
  // proposal.extractedData.totalAmount / .installments / .creditorName /
  // .summary / .firstDueDate diretamente, sem navegar objeto aninhado. Se
  // estes campos forem removidos ou movidos para dentro de financialOperation,
  // a confirmação financeira quebra.
  creditorName: string | null; contractNumber: string | null; totalAmount: number | null; installmentAmount: number | null;
  installments: number | null; paidInstallments: number | null; remainingInstallments: number | null; firstDueDate: string | null;
  dueDay: number | null; interestRate: number | null; cet: number | null; iof: number | null; fine: number | null;
  guarantees: string[]; categorySuggestion: string | null; missingFields: string[];
};

/** Decisão final de decideDocumentAction — o único portão consultado pelo worker. */
export type DocumentAction = 'ARCHIVE' | 'CREATE_FINANCIAL_PROPOSAL' | 'ASK_USER';

export interface DocumentTextExtractor { extract(input: { content: Buffer; fileName: string; mimeType: string }): Promise<string>; }
export interface ContractDataExtractor { extract(text: string): Promise<ContractPreview>; }
export interface ContractPreviewValidator { validate(preview: ContractPreview): { valid: boolean; warnings: string[] }; }

export const MAX_DOCUMENT_ANALYSIS_ATTEMPTS = 3;

export function documentAnalysisBackoffMs(attempt: number): number {
  return 2 ** Math.max(1, attempt) * 60_000;
}

export function shouldRetryDocumentAnalysis(error: unknown, attempt: number): boolean {
  return error instanceof DocumentError
    && error.retryable
    && attempt < MAX_DOCUMENT_ANALYSIS_ATTEMPTS;
}

export async function claimDocumentAnalysisJob(jobId: string, runnerId: string): Promise<boolean> {
  const claimed = await prisma.documentAnalysisJob.updateMany({
    where: { id: jobId, status: 'QUEUED' },
    data: {
      status: 'PROCESSING',
      lockedAt: new Date(),
      lockedBy: runnerId,
      attempts: { increment: 1 },
    },
  });
  return claimed.count === 1;
}

export type DocumentAnalysisProgressStage = 'READING_DOCUMENT' | 'IDENTIFYING_TYPE' | 'EXTRACTING_DATA' | 'PREPARING_RECOMMENDATION' | 'COMPLETED' | 'FAILED';

/**
 * Avança o `progressStage` humano de um job (Fase F). Só o worker chama
 * isto — nunca o cliente. É puramente cosmético (alimenta o polling curto
 * da UI, ver `app/api/documents/[id]/analysis-progress/route.ts`): uma
 * falha aqui nunca deve derrubar a análise real, por isso é best-effort
 * (`.catch`). `lockedBy: runnerId` evita pisar no progresso se este job já
 * foi liberado por outro runner (timeout/recovery) enquanto este seguia
 * processando.
 */
async function setDocumentAnalysisProgressStage(jobId: string, runnerId: string, stage: DocumentAnalysisProgressStage): Promise<void> {
  await prisma.documentAnalysisJob.updateMany({ where: { id: jobId, lockedBy: runnerId }, data: { progressStage: stage } }).catch(() => undefined);
}

function assertDocumentAnalysisEnabled(): void {
  if (process.env.OPENAI_DOCUMENT_ANALYSIS_ENABLED !== 'true') {
    throw new DocumentError(
      'MODEL_UNSUPPORTED',
      'A análise por IA está desativada neste ambiente.',
      false,
      { provider: 'openai', featureEnabled: false },
    );
  }
}

const DOCUMENT_CLASSIFICATION_TYPES = new Set<DocumentClassificationType>(['CONTRACT_SOCIAL', 'FINANCING_CONTRACT', 'LOAN_CONTRACT', 'INVOICE', 'RECEIPT', 'PAYMENT_PROOF', 'TAX_DOCUMENT', 'PERSONAL_DOCUMENT', 'LEGAL_DOCUMENT', 'OTHER']);
const DOCUMENT_INTENTS = new Set<DocumentIntent>(['ARCHIVE_ONLY', 'EXTRACT_INFORMATION', 'FINANCIAL_ACTION_REQUIRED', 'REVIEW_REQUIRED']);
const EMPTY_PREVIEW: ContractPreview = { documentType: 'OTHER', documentIntent: 'REVIEW_REQUIRED', confidence: 'low', summary: '', entities: { company: null, people: [], dates: [], amounts: [] }, financialOperation: { detected: false, type: null, creditor: null, amount: null, installments: null }, suggestedActions: [], creditorName: null, contractNumber: null, totalAmount: null, installmentAmount: null, installments: null, paidInstallments: null, remainingInstallments: null, firstDueDate: null, dueDay: null, interestRate: null, cet: null, iof: null, fine: null, guarantees: [], categorySuggestion: null, missingFields: [] };
const webBody = (buffer: Buffer): ArrayBuffer => Uint8Array.from(buffer).buffer;
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const integer = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
const string = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : null;
const stringArray = (value: unknown, max: number) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, max) : [];
const numberArray = (value: unknown, max: number) => Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item)).slice(0, max) : [];

function errorForResponse(status: number, diagnostics: Record<string, string | number | boolean> = {}): DocumentError {
  const base = { provider: 'openai', httpStatus: status, ...diagnostics };
  if (status === 401 || status === 403) return new DocumentError('PROVIDER_AUTH_ERROR', 'A credencial de análise de documentos foi recusada.', false, base);
  if (status === 429) return new DocumentError('PROVIDER_RATE_LIMIT', 'A análise está ocupada; tente novamente em alguns minutos.', true, { ...base, category: 'RATE_LIMIT' });
  if (status >= 500) return new DocumentError('PROVIDER_TEMPORARY_ERROR', 'O provedor de análise está indisponível.', true, { ...base, category: 'MODEL_ERROR' });
  return new DocumentError('MODEL_UNSUPPORTED', 'Este documento não pode ser analisado pelo modelo configurado.', false, { ...base, category: 'MODEL_ERROR' });
}

async function openAIRequest(url: string, init: RequestInit, model: string) {
  const startedAt = Date.now();
  const timeout = Math.max(5_000, Number(process.env.DOCUMENT_ANALYSIS_TIMEOUT_MS ?? 90_000));
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
    const diagnostics: Record<string, string | number | boolean> = {
      provider: 'openai', model, httpStatus: response.status, durationMs: Date.now() - startedAt,
      requestId: response.headers.get('x-request-id') ?? 'unavailable',
    };
    if (!response.ok) {
      // A OpenAI devolve o motivo real em { error: { message, type, code } }.
      // Sem capturar isto, todo 400 vira o rótulo genérico MODEL_UNSUPPORTED
      // sem explicar por quê (ver errorForResponse).
      const providerError = await response.json().catch(() => null) as { error?: { message?: string; type?: string; code?: string } } | null;
      if (providerError?.error?.message) diagnostics.providerMessage = providerError.error.message;
      if (providerError?.error?.type) diagnostics.providerErrorType = providerError.error.type;
      if (providerError?.error?.code) diagnostics.providerErrorCode = providerError.error.code;
      throw errorForResponse(response.status, diagnostics);
    }
    return { response, diagnostics };
  } catch (error) {
    if (error instanceof DocumentError) throw error;
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    throw new DocumentError(timedOut ? 'PROVIDER_TIMEOUT' : 'PROVIDER_TEMPORARY_ERROR', timedOut ? 'A análise demorou mais do que o permitido.' : 'A conexão com o provedor de análise falhou.', true, { provider: 'openai', model, durationMs: Date.now() - startedAt, category: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR' });
  }
}

/** OpenAI é usado apenas temporariamente para extração; nunca como storage. */
export class OpenAITemporaryTextExtractor implements DocumentTextExtractor {
  async extract(input: { content: Buffer; fileName: string; mimeType: string }): Promise<string> {
    assertDocumentAnalysisEnabled();
    const key = process.env.OPENAI_API_KEY; if (!key) throw new DocumentError('PROVIDER_AUTH_ERROR', 'A análise por IA não está configurada.');
    const form = new FormData(); form.set('purpose', 'user_data'); form.set('file', new File([webBody(input.content)], input.fileName, { type: input.mimeType }));
    const model = process.env.OPENAI_MODEL || 'gpt-5.5';
    const uploadRequest = await openAIRequest('https://api.openai.com/v1/files', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form }, model);
    const fileId = (await uploadRequest.response.json() as { id?: string }).id; if (!fileId) throw new DocumentError('EXTRACTION_INVALID', 'A IA não retornou identificação temporária para o arquivo.', false, uploadRequest.diagnostics);
    try {
      const request = await openAIRequest('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ model, input: [{ role: 'user', content: [{ type: 'input_file', file_id: fileId }, { type: 'input_text', text: 'Transcreva somente o texto legível deste documento, sem interpretar nem resumir.' }] }], max_output_tokens: 6000 }) }, model);
      const payload = await request.response.json() as { output?: Array<{ content?: Array<{ text?: string }> }> };
      const text = payload.output?.flatMap((output) => output.content ?? []).map((content) => content.text).find((value): value is string => Boolean(value?.trim()));
      if (!text) throw new DocumentError('EXTRACTION_INVALID', 'Nenhum texto legível foi extraído do arquivo.', false, request.diagnostics); return text;
    } finally { await fetch(`https://api.openai.com/v1/files/${encodeURIComponent(fileId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${key}` } }).catch(() => undefined); }
  }
}

export class OpenAIContractDataExtractor implements ContractDataExtractor {
  async extract(text: string): Promise<ContractPreview> {
    assertDocumentAnalysisEnabled();
    const key = process.env.OPENAI_API_KEY; if (!key) throw new DocumentError('PROVIDER_AUTH_ERROR', 'A análise por IA não está configurada.');
    const instruction = 'Classifique o documento antes de extrair dados financeiros. Nunca trate capital social, patrimônio, valor declarado, valor de imóvel ou preço de venda como dívida ou parcelamento — isso nunca é financialOperation.detected=true. Só marque financialOperation.detected=true quando houver obrigação de pagamento futura clara (parcelas, financiamento, empréstimo) com credor e valor definidos no texto. Se a confiança for baixa ou o documento for ambíguo, não invente dados: use confidence="low"; quando não houver texto legível suficiente para classificar, use documentIntent="REVIEW_REQUIRED". Retorne um único JSON com exatamente estes campos: documentType (um destes: CONTRACT_SOCIAL, FINANCING_CONTRACT, LOAN_CONTRACT, INVOICE, RECEIPT, PAYMENT_PROOF, TAX_DOCUMENT, PERSONAL_DOCUMENT, LEGAL_DOCUMENT, OTHER), documentIntent (um destes: ARCHIVE_ONLY, EXTRACT_INFORMATION, FINANCIAL_ACTION_REQUIRED, REVIEW_REQUIRED), confidence (high, medium ou low), summary, entities (objeto com company, people, dates, amounts), financialOperation (objeto com detected, type, creditor, amount, installments), suggestedActions (lista curta de ações sugeridas ao usuário), creditorName, contractNumber, totalAmount, installmentAmount, installments, paidInstallments, remainingInstallments, firstDueDate, dueDay, interestRate, cet, iof, fine, guarantees, categorySuggestion, missingFields. Quando financialOperation.detected=true, repita os mesmos valores de credor/valor/parcelas em creditorName/totalAmount/installments (compatibilidade com a confirmação financeira existente); quando detected=false, esses campos ficam null. Valores são números sem R$. Datas completas YYYY-MM-DD. Campos ausentes ou não aplicáveis: null (ou lista vazia) e listados em missingFields.';
    const model = process.env.OPENAI_MODEL || 'gpt-5.5';
    // A OpenAI exige que a palavra "json" apareça nas mensagens de input
    // quando text.format = json_object — não basta estar só em "instructions"
    // (erro real: "Response input messages must contain the word 'json'...").
    const input = `Responda em JSON conforme as instruções.\n\n${text.slice(0, 100_000)}`;
    const request = await openAIRequest('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ model, instructions: instruction, input, text: { format: { type: 'json_object' } }, max_output_tokens: 1800 }) }, model);
    const payload = await request.response.json() as { output?: Array<{ content?: Array<{ text?: string }> }> };
    const output = payload.output?.flatMap((item) => item.content ?? []).map((item) => item.text).find(Boolean); if (!output) throw new DocumentError('EXTRACTION_INVALID', 'A IA não retornou uma prévia estruturada.');
    try {
      const raw = JSON.parse(output) as Record<string, unknown>;
      const confidence = raw.confidence === 'high' || raw.confidence === 'medium' ? raw.confidence : 'low';
      const documentType = typeof raw.documentType === 'string' && DOCUMENT_CLASSIFICATION_TYPES.has(raw.documentType as DocumentClassificationType) ? raw.documentType as DocumentClassificationType : 'OTHER';
      const documentIntent = typeof raw.documentIntent === 'string' && DOCUMENT_INTENTS.has(raw.documentIntent as DocumentIntent) ? raw.documentIntent as DocumentIntent : 'REVIEW_REQUIRED';
      const rawEntities = (raw.entities && typeof raw.entities === 'object' ? raw.entities : {}) as Record<string, unknown>;
      const entities: DocumentEntities = { company: string(rawEntities.company), people: stringArray(rawEntities.people, 20), dates: stringArray(rawEntities.dates, 20), amounts: numberArray(rawEntities.amounts, 20) };
      const rawFinancial = (raw.financialOperation && typeof raw.financialOperation === 'object' ? raw.financialOperation : {}) as Record<string, unknown>;
      const financialOperation: DocumentFinancialOperation = { detected: rawFinancial.detected === true, type: string(rawFinancial.type), creditor: string(rawFinancial.creditor), amount: number(rawFinancial.amount), installments: integer(rawFinancial.installments) };
      return {
        ...EMPTY_PREVIEW,
        documentType, documentIntent, confidence,
        summary: string(raw.summary) ?? 'Prévia gerada para revisão.',
        entities, financialOperation,
        suggestedActions: stringArray(raw.suggestedActions, 10),
        // Fallback defensivo: se a IA só preencher o objeto aninhado
        // financialOperation e esquecer o espelho flat (ou vice-versa),
        // reconciliamos aqui — confirm/route.ts só lê os campos flat.
        creditorName: string(raw.creditorName) ?? financialOperation.creditor,
        contractNumber: string(raw.contractNumber),
        totalAmount: number(raw.totalAmount) ?? financialOperation.amount,
        installmentAmount: number(raw.installmentAmount),
        installments: integer(raw.installments) ?? financialOperation.installments,
        paidInstallments: integer(raw.paidInstallments),
        remainingInstallments: integer(raw.remainingInstallments),
        firstDueDate: string(raw.firstDueDate),
        dueDay: integer(raw.dueDay),
        interestRate: number(raw.interestRate),
        cet: number(raw.cet),
        iof: number(raw.iof),
        fine: number(raw.fine),
        guarantees: stringArray(raw.guarantees, 10),
        categorySuggestion: string(raw.categorySuggestion),
        missingFields: stringArray(raw.missingFields, 30),
      };
    } catch { throw new DocumentError('EXTRACTION_INVALID', 'A IA retornou uma prévia em formato inválido.', false, request.diagnostics); }
  }
}

export const contractPreviewValidator: ContractPreviewValidator = { validate(preview) { const warnings = [...preview.missingFields]; if (!preview.creditorName) warnings.push('Credor não identificado.'); if (!preview.totalAmount && !preview.installmentAmount) warnings.push('Valor não identificado.'); if (!preview.installments || preview.installments < 2) warnings.push('Quantidade de parcelas não identificada.'); return { valid: warnings.length === 0, warnings: [...new Set(warnings)] }; } };

/**
 * Confirma se a operação financeira detectada tem dados mínimos de crédito
 * para virar proposta acionável. Fecha por padrão:
 * financialOperation.detected=true sozinho não basta — exige credor, valor
 * total e parcelas > 0 nos campos flat (os mesmos que confirm/route.ts lê).
 * Capital social e valores meramente declarativos
 * (financialOperation.detected=false) nunca passam por aqui.
 */
export function isFinancialInstallmentProposal(preview: ContractPreview): boolean {
  return preview.financialOperation.detected === true
    && Boolean(preview.creditorName)
    && preview.totalAmount != null
    && preview.installments != null && preview.installments > 0;
}

/**
 * Único ponto de decisão sobre o destino de um documento classificado.
 * Nunca assume: confiança baixa ou texto ausente/ilegível (documentIntent
 * REVIEW_REQUIRED) sempre pedem confirmação do usuário (ASK_USER), assim
 * como uma intenção financeira sem dados mínimos de crédito. Só
 * ARCHIVE_ONLY/EXTRACT_INFORMATION arquivam automaticamente — nunca geram
 * proposta financeira acionável.
 */
export function decideDocumentAction(preview: ContractPreview): DocumentAction {
  if (preview.confidence === 'low') return 'ASK_USER';
  if (preview.documentIntent === 'REVIEW_REQUIRED') return 'ASK_USER';
  if (preview.documentIntent === 'FINANCIAL_ACTION_REQUIRED') return isFinancialInstallmentProposal(preview) ? 'CREATE_FINANCIAL_PROPOSAL' : 'ASK_USER';
  return 'ARCHIVE';
}

const DOCUMENT_TYPE_LABELS: Record<DocumentClassificationType, string> = {
  CONTRACT_SOCIAL: 'um Contrato Social',
  FINANCING_CONTRACT: 'um contrato de financiamento',
  LOAN_CONTRACT: 'um contrato de empréstimo',
  INVOICE: 'uma nota fiscal',
  RECEIPT: 'um recibo',
  PAYMENT_PROOF: 'um comprovante de pagamento',
  TAX_DOCUMENT: 'um documento fiscal',
  PERSONAL_DOCUMENT: 'um documento pessoal',
  LEGAL_DOCUMENT: 'um documento jurídico',
  OTHER: 'um documento',
};

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/**
 * Conteúdo apresentável da `ConversationTask` que a NOVA mostra quando um
 * documento termina de ser analisado (Fase C — "NOVA como centro da
 * experiência"). Vive aqui, não em `services/conversation-tasks`, porque
 * só quem conhece `ContractPreview`/`DocumentAction` sabe traduzir a
 * decisão em título/mensagem/ações — a infraestrutura genérica de
 * `ConversationTask` nunca sabe o que é um documento.
 *
 * `actions` usa sempre o mesmo shape genérico `{ id, label }` (ver
 * `ConversationTaskAction`) — nenhum campo específico de Documentos
 * vaza para fora daqui. `proposalValid` decide entre convidar para o
 * cadastro em chat (dados mínimos de crédito confirmados) ou pedir
 * revisão manual (dados insuficientes ou confiança baixa) — nunca
 * inventa um valor que a IA não confirmou.
 */
export function buildDocumentConversationTaskContent(
  preview: ContractPreview,
  decision: DocumentAction,
  proposalValid: boolean
): { title: string; message: string; priority: ConversationTaskPriority; actions: ConversationTaskAction[] } {
  const tipoLabel = DOCUMENT_TYPE_LABELS[preview.documentType] ?? 'um documento';

  if (decision === 'CREATE_FINANCIAL_PROPOSAL' && proposalValid) {
    const { financialOperation } = preview;
    const tipo = financialOperation.type ? financialOperation.type.toLocaleLowerCase('pt-BR').replace(/_/g, ' ') : 'financiamento';
    return {
      title: `Financiamento identificado: ${financialOperation.creditor}`,
      message: `Identifiquei ${tipo} ${financialOperation.creditor} de ${formatBRL(preview.totalAmount as number)} em ${preview.installments}x. Quer que eu cadastre?`,
      priority: 'HIGH',
      // "Depois"/dispensar é um botão genérico da própria bolha da NOVA
      // (Fase D — `nova-message-bubble.tsx`), nunca uma ação aqui: qualquer
      // ConversationTask futura ganha o mesmo botão de graça, sem precisar
      // declarar seu próprio "depois".
      // "cadastrar_financiamento" exige conta e categoria (Fase E — nunca
      // assumida, sempre coletada em chat com opções reais antes de
      // confirmar). "guardar_documento" não precisa de nada além do clique.
      actions: [
        { id: 'cadastrar_financiamento', label: 'Cadastrar financiamento', requiresFields: ['accountId', 'categoryId'] },
        { id: 'guardar_documento', label: 'Só guardar' },
      ],
    };
  }

  if (decision === 'ASK_USER' || (decision === 'CREATE_FINANCIAL_PROPOSAL' && !proposalValid)) {
    const resumo = preview.summary ? ` ${preview.summary}` : '';
    return {
      title: `Preciso da sua confirmação: ${tipoLabel}`,
      message: `Analisei ${tipoLabel} que você enviou, mas não tenho certeza suficiente pra agir sozinha.${resumo} Pode revisar e confirmar?`,
      priority: 'MEDIUM',
      actions: [
        { id: 'revisar_documento', label: 'Revisar documento' },
        { id: 'guardar_documento', label: 'Só guardar' },
      ],
    };
  }

  // ARCHIVE: informativo, sem ação financeira associada.
  const resumo = preview.summary ? ` ${preview.summary}` : '';
  const acaoSugerida = preview.suggestedActions[0];
  return {
    title: `Documento arquivado: ${tipoLabel}`,
    message: `Analisei ${tipoLabel} que você guardou.${resumo}${acaoSugerida ? ` ${acaoSugerida}` : ''}`,
    priority: 'LOW',
    actions: [{ id: 'ver_documento', label: 'Ver documento' }],
  };
}

/** Um worker chama isto. A API pública só enfileira; ela não processa. */
async function recoverInterruptedDocumentAnalysisJobs() {
  const lockTimeoutMs = Math.max(60_000, Number(process.env.DOCUMENT_ANALYSIS_LOCK_TIMEOUT_MS ?? 10 * 60_000));
  const before = new Date(Date.now() - lockTimeoutMs);
  const staleJobs = await prisma.documentAnalysisJob.findMany({
    where: { status: 'PROCESSING', lockedAt: { lt: before } },
    select: { id: true, documentId: true, document: { select: { userId: true } } },
    take: 20,
  });
  for (const staleJob of staleJobs) {
    const released = await prisma.documentAnalysisJob.updateMany({
      where: { id: staleJob.id, status: 'PROCESSING', lockedAt: { lt: before } },
      // progressStage volta pro início (Fase F): o próximo runner refaz o
      // pipeline inteiro, o estágio salvo do worker interrompido não vale mais.
      data: { status: 'QUEUED', progressStage: 'READING_DOCUMENT', lockedAt: null, lockedBy: null, runAfter: new Date(), lastErrorCode: 'WORKER_INTERRUPTED', lastErrorMessage: 'A análise foi retomada após interrupção do worker.' },
    });
    if (!released.count) continue;
    await prisma.storedDocument.updateMany({ where: { id: staleJob.documentId, analysisStatus: 'PROCESSING' }, data: { analysisStatus: 'QUEUED' } });
    await enqueueDocumentAnalysisJob(staleJob.id).catch(() => undefined);
    await auditDocument({ userId: staleJob.document.userId, documentId: staleJob.documentId, operation: 'DOCUMENT_ANALYSIS_RECOVERED', source: 'system', entityType: 'document_analysis_job', entityId: staleJob.id });
  }
}

export async function processNextDocumentAnalysisJob() {
  await recoverInterruptedDocumentAnalysisJobs();
  const queuedJobId = await dequeueDocumentAnalysisJobSafely();
  const job = await prisma.documentAnalysisJob.findFirst({ where: { ...(queuedJobId ? { id: queuedJobId } : {}), status: 'QUEUED', runAfter: { lte: new Date() } }, orderBy: { createdAt: 'asc' }, include: { document: true } });
  if (!job) return null;
  const runnerId = randomUUID();
  if (!(await claimDocumentAnalysisJob(job.id, runnerId))) return null;
  const document = job.document;
  try {
    if (!document.storageKey || document.scanStatus !== 'CLEAN') throw new DocumentError('SECURITY_SCAN_PENDING', 'A análise exige arquivo limpo no storage privado.');
    await prisma.storedDocument.update({ where: { id: document.id }, data: { analysisStatus: 'PROCESSING', analysisStartedAt: new Date(), analysisAttempts: { increment: 1 } } });
    await auditDocument({ userId: document.userId, documentId: document.id, operation: 'DOCUMENT_ANALYSIS_STARTED', source: 'system', entityType: 'document', entityId: document.id });
    // Fase F: progressStage já nasce em READING_DOCUMENT (default do schema
    // e reset a cada reenfileiramento — ver enqueueDocumentAnalysis) e cobre
    // esta etapa inteira, sem escrita própria aqui.
    const content = await documentStorage().get(document.storageKey);
    const text = await new OpenAITemporaryTextExtractor().extract({ content, fileName: document.originalFileName, mimeType: document.detectedMimeType || document.mimeType });
    // IDENTIFYING_TYPE/EXTRACTING_DATA (Fase F): a mesma chamada única à IA
    // classifica E extrai — ver doc do enum em schema.prisma. IDENTIFYING_TYPE
    // cobre a chamada de rede (a parte lenta); EXTRACTING_DATA marca que a
    // resposta já chegou estruturada, antes de decidir o destino do documento.
    await setDocumentAnalysisProgressStage(job.id, runnerId, 'IDENTIFYING_TYPE');
    const preview = await new OpenAIContractDataExtractor().extract(text);
    await setDocumentAnalysisProgressStage(job.id, runnerId, 'EXTRACTING_DATA');
    // decideDocumentAction é o único portão: ARCHIVE (guarda com
    // classificação/resumo, sem proposta acionável), CREATE_FINANCIAL_PROPOSAL
    // (dados mínimos de crédito confirmados) ou ASK_USER (baixa confiança,
    // texto ilegível ou intenção financeira sem dados suficientes — nunca
    // adivinha). Todo documento classificado gera um DocumentImportProposal
    // (mesmo ARCHIVE), para a tela de Documentos mostrar tipo/resumo; só o
    // status muda. ARCHIVED nunca é acionável nem confirmável — é distinto de
    // DISCARDED, que continua significando rejeição manual do usuário (ver
    // app/api/document-previews/[id]/discard/route.ts).
    const decision = decideDocumentAction(preview);
    const isFinancial = decision === 'CREATE_FINANCIAL_PROPOSAL';
    const validation = isFinancial
      ? contractPreviewValidator.validate(preview)
      : { valid: true, warnings: decision === 'ASK_USER' ? ['Classificação incerta — confirme manualmente se este documento representa uma operação financeira.'] : [] as string[] };
    const proposalStatus: 'READY_FOR_REVIEW' | 'PENDING' | 'ARCHIVED' = decision === 'ARCHIVE' ? 'ARCHIVED' : (isFinancial && !validation.valid ? 'PENDING' : 'READY_FOR_REVIEW');
    const documentAnalysisStatus: 'COMPLETED' | 'NEEDS_REVIEW' = isFinancial && !validation.valid ? 'NEEDS_REVIEW' : 'COMPLETED';
    const previewKey = `document-preview:${document.id}:v${document.analysisVersion}`;
    // Mesma idempotencyKey "por versão de análise" do preview, só com um
    // prefixo diferente — nasce na MESMA transação que a proposta, então
    // as duas existem juntas ou nenhuma existe.
    const conversationTaskKey = `conversation-task:document-analysis:${document.id}:v${document.analysisVersion}`;
    const conversationTaskContent = buildDocumentConversationTaskContent(preview, decision, isFinancial && validation.valid);
    // PREPARING_RECOMMENDATION (Fase F): decisão, validação e o texto da
    // ConversationTask já estão prontos — o que falta é persistir tudo na
    // mesma transação abaixo (proposta + task), a etapa que a UI narra como
    // "preparando recomendação".
    await setDocumentAnalysisProgressStage(job.id, runnerId, 'PREPARING_RECOMMENDATION');
    const committed = await prisma.$transaction(async (tx) => {
      const ownership = await tx.documentAnalysisJob.updateMany({ where: { id: job.id, status: 'PROCESSING', lockedBy: runnerId }, data: { status: 'COMPLETED', progressStage: 'COMPLETED', lockedAt: null, lockedBy: null } });
      if (!ownership.count) return null;
      const existingProposal = await tx.documentImportProposal.findFirst({ where: { idempotencyKey: previewKey }, select: { id: true } });
      const proposal = await tx.documentImportProposal.upsert({ where: { idempotencyKey: previewKey }, create: { userId: document.userId, documentId: document.id, analysisVersion: document.analysisVersion, idempotencyKey: previewKey, status: proposalStatus, extractedData: preview as unknown as Prisma.InputJsonValue, validationWarnings: validation.warnings }, update: { extractedData: preview as unknown as Prisma.InputJsonValue, validationWarnings: validation.warnings, status: proposalStatus } });
      await tx.storedDocument.update({ where: { id: document.id }, data: { analysisStatus: documentAnalysisStatus, analysisCompletedAt: new Date(), analysisErrorCode: null, analysisErrorMessage: null } });
      // "A NOVA só conversa consumindo ConversationTasks" — todo documento
      // classificado gera uma task (mesmo ARCHIVE, que fica com prioridade
      // baixa e uma única ação informativa), nunca só quando é financeiro.
      const conversationTask = await createConversationTask({
        userId: document.userId,
        type: 'DOCUMENT_ANALYSIS_COMPLETED',
        priority: conversationTaskContent.priority,
        title: conversationTaskContent.title,
        message: conversationTaskContent.message,
        // creditor/amount/installments: só pro resumo final que a NOVA
        // mostra antes de executar (Fase E — "mostrar resumo antes de
        // executar"), pra não precisar buscar a proposta de novo só pra
        // montar uma frase. NUNCA a fonte de verdade pra decidir dinheiro —
        // o handler de resolução sempre busca o DocumentImportProposal
        // atual de novo antes de agir (ver services/documents/conversation-task-handler.ts).
        payload: {
          proposalId: proposal.id,
          documentId: document.id,
          documentType: preview.documentType,
          decision,
          creditor: preview.financialOperation.creditor,
          amount: preview.totalAmount,
          installments: preview.installments,
        },
        actions: conversationTaskContent.actions,
        sourceType: 'document_import_proposal',
        sourceId: proposal.id,
        idempotencyKey: conversationTaskKey,
      }, tx);
      return { proposal, existingProposal, conversationTask };
    });
    if (!committed) return { jobId: job.id, skipped: true };
    const { proposal, existingProposal, conversationTask } = committed;
    await auditDocument({ userId: document.userId, documentId: document.id, proposalId: proposal.id, operation: existingProposal ? 'PREVIEW_UPDATED' : 'PREVIEW_CREATED', source: 'system', entityType: 'document_preview', entityId: proposal.id, after: { valid: validation.valid, warnings: validation.warnings, status: proposalStatus } });
    await auditDocument({ userId: document.userId, documentId: document.id, proposalId: proposal.id, operation: 'DOCUMENT_CLASSIFIED', source: 'system', entityType: 'document', entityId: document.id, after: { documentType: preview.documentType, documentIntent: preview.documentIntent, confidence: preview.confidence, decision } });
    await auditDocument({ userId: document.userId, documentId: document.id, proposalId: proposal.id, operation: 'DOCUMENT_ANALYZED', source: 'system', entityType: 'document', entityId: document.id, after: { valid: validation.valid, documentType: preview.documentType, documentIntent: preview.documentIntent, decision, summary: preview.summary } });
    // correlationId da task = task.id: o mesmo id serve de correlationId
    // durante toda a cadeia de resolução (CONVERSATION_TASK_PRESENTED na
    // Fase D, CONVERSATION_TASK_USER_CONFIRMED/DISMISSED e
    // PREVIEW_CONFIRMED na Fase E) — nenhuma tabela nova, nenhum estado
    // extra pra carregar entre requisições HTTP separadas no tempo.
    if (conversationTask.created) {
      await auditDocument({ userId: document.userId, documentId: document.id, proposalId: proposal.id, operation: 'CONVERSATION_TASK_CREATED', source: 'system', entityType: 'conversation_task', entityId: conversationTask.task.id, correlationId: conversationTask.task.id, after: { type: conversationTask.task.type, priority: conversationTask.task.priority, sourceId: conversationTask.task.sourceId } });
    }
    return { jobId: job.id, proposalId: proposal.id, decision };
  } catch (error) {
    const code = error instanceof DocumentError ? error.code : 'UNKNOWN';
    // Preferir a mensagem real da OpenAI (já sanitizada/truncada por
    // sanitizeDocumentDiagnostics em DocumentError) quando disponível, em vez
    // do rótulo genérico — assim lastErrorMessage/analysisErrorMessage
    // mostram a causa real sem precisar abrir o JSON de auditoria.
    const providerMessage = error instanceof DocumentError && typeof error.diagnostics?.providerMessage === 'string' ? error.diagnostics.providerMessage : undefined;
    const message = providerMessage ?? (error instanceof Error ? error.message : 'Erro desconhecido');
    const attempt = job.attempts + 1;
    const retry = shouldRetryDocumentAnalysis(error, attempt);
    const runAfter = retry ? new Date(Date.now() + documentAnalysisBackoffMs(attempt)) : new Date();
    // progressStage (Fase F): tentativa nova volta pro início do pipeline
    // (READING_DOCUMENT) — o próximo runner refaz tudo, nenhum estágio
    // anterior ainda é válido; falha definitiva marca FAILED, terminal.
    const released = await prisma.documentAnalysisJob.updateMany({ where: { id: job.id, status: 'PROCESSING', lockedBy: runnerId }, data: { status: retry ? 'QUEUED' : 'FAILED', progressStage: retry ? 'READING_DOCUMENT' : 'FAILED', runAfter, lastErrorCode: code, lastErrorMessage: message.slice(0, 500), lockedAt: null, lockedBy: null } });
    if (!released.count) return { jobId: job.id, skipped: true };
    await prisma.storedDocument.update({ where: { id: document.id }, data: { analysisStatus: retry ? 'QUEUED' : 'FAILED', analysisErrorCode: code, analysisErrorMessage: message.slice(0, 500) } });
    if (retry) await enqueueDocumentAnalysisJob(job.id).catch(() => undefined);
    await auditDocument({ userId: document.userId, documentId: document.id, operation: 'DOCUMENT_ANALYSIS_FAILED', source: 'system', entityType: 'document', entityId: document.id, after: { code, retry, attempt, ...(error instanceof DocumentError && error.diagnostics ? { diagnostics: error.diagnostics } : {}) } });
    return { jobId: job.id, failed: true, retry };
  }
}
