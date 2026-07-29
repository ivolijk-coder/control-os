import 'server-only';

import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { auditDocument, documentStorage, DocumentError } from './document-core';
import { dequeueDocumentAnalysisJobSafely, enqueueDocumentAnalysisJob } from './document-analysis-queue';

export type ContractPreview = {
  creditorName: string | null; contractNumber: string | null; totalAmount: number | null; installmentAmount: number | null;
  installments: number | null; paidInstallments: number | null; remainingInstallments: number | null; firstDueDate: string | null;
  dueDay: number | null; interestRate: number | null; cet: number | null; iof: number | null; fine: number | null;
  guarantees: string[]; categorySuggestion: string | null; summary: string; confidence: 'high' | 'medium' | 'low'; missingFields: string[];
};

export interface DocumentTextExtractor { extract(input: { content: Buffer; fileName: string; mimeType: string }): Promise<string>; }
export interface ContractDataExtractor { extract(text: string): Promise<ContractPreview>; }
export interface ContractPreviewValidator { validate(preview: ContractPreview): { valid: boolean; warnings: string[] }; }

const EMPTY_PREVIEW: ContractPreview = { creditorName: null, contractNumber: null, totalAmount: null, installmentAmount: null, installments: null, paidInstallments: null, remainingInstallments: null, firstDueDate: null, dueDay: null, interestRate: null, cet: null, iof: null, fine: null, guarantees: [], categorySuggestion: null, summary: '', confidence: 'low', missingFields: [] };
const webBody = (buffer: Buffer): ArrayBuffer => Uint8Array.from(buffer).buffer;
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const integer = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
const string = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : null;

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
    const diagnostics = {
      provider: 'openai', model, httpStatus: response.status, durationMs: Date.now() - startedAt,
      requestId: response.headers.get('x-request-id') ?? 'unavailable',
    };
    if (!response.ok) throw errorForResponse(response.status, diagnostics);
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
    const key = process.env.OPENAI_API_KEY; if (!key) throw new DocumentError('PROVIDER_AUTH_ERROR', 'A análise por IA não está configurada.');
    const instruction = 'Extraia somente fatos explícitos de contrato financeiro brasileiro. Retorne JSON com creditorName, contractNumber, totalAmount, installmentAmount, installments, paidInstallments, remainingInstallments, firstDueDate, dueDay, interestRate, cet, iof, fine, guarantees, categorySuggestion, summary, confidence, missingFields. Valores são números sem R$. Datas completas YYYY-MM-DD. Campos ausentes null e listados.';
    const model = process.env.OPENAI_MODEL || 'gpt-5.5';
    const request = await openAIRequest('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ model, instructions: instruction, input: text.slice(0, 100_000), text: { format: { type: 'json_object' } }, max_output_tokens: 1800 }) }, model);
    const payload = await request.response.json() as { output?: Array<{ content?: Array<{ text?: string }> }> };
    const output = payload.output?.flatMap((item) => item.content ?? []).map((item) => item.text).find(Boolean); if (!output) throw new DocumentError('EXTRACTION_INVALID', 'A IA não retornou uma prévia estruturada.');
    try { const raw = JSON.parse(output) as Record<string, unknown>; const confidence = raw.confidence === 'high' || raw.confidence === 'medium' ? raw.confidence : 'low'; return { ...EMPTY_PREVIEW, creditorName: string(raw.creditorName), contractNumber: string(raw.contractNumber), totalAmount: number(raw.totalAmount), installmentAmount: number(raw.installmentAmount), installments: integer(raw.installments), paidInstallments: integer(raw.paidInstallments), remainingInstallments: integer(raw.remainingInstallments), firstDueDate: string(raw.firstDueDate), dueDay: integer(raw.dueDay), interestRate: number(raw.interestRate), cet: number(raw.cet), iof: number(raw.iof), fine: number(raw.fine), guarantees: Array.isArray(raw.guarantees) ? raw.guarantees.filter((item): item is string => typeof item === 'string').slice(0, 10) : [], categorySuggestion: string(raw.categorySuggestion), summary: string(raw.summary) ?? 'Prévia gerada para revisão.', confidence, missingFields: Array.isArray(raw.missingFields) ? raw.missingFields.filter((item): item is string => typeof item === 'string').slice(0, 30) : [] }; } catch { throw new DocumentError('EXTRACTION_INVALID', 'A IA retornou uma prévia em formato inválido.', false, request.diagnostics); }
  }
}

export const contractPreviewValidator: ContractPreviewValidator = { validate(preview) { const warnings = [...preview.missingFields]; if (!preview.creditorName) warnings.push('Credor não identificado.'); if (!preview.totalAmount && !preview.installmentAmount) warnings.push('Valor não identificado.'); if (!preview.installments || preview.installments < 2) warnings.push('Quantidade de parcelas não identificada.'); return { valid: warnings.length === 0, warnings: [...new Set(warnings)] }; } };

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
      data: { status: 'QUEUED', lockedAt: null, lockedBy: null, runAfter: new Date(), lastErrorCode: 'WORKER_INTERRUPTED', lastErrorMessage: 'A análise foi retomada após interrupção do worker.' },
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
  const claimed = await prisma.documentAnalysisJob.updateMany({ where: { id: job.id, status: 'QUEUED' }, data: { status: 'PROCESSING', lockedAt: new Date(), lockedBy: runnerId, attempts: { increment: 1 } } }); if (!claimed.count) return null;
  const document = job.document;
  try {
    if (!document.storageKey || document.scanStatus !== 'CLEAN') throw new DocumentError('SECURITY_SCAN_PENDING', 'A análise exige arquivo limpo no storage privado.');
    await prisma.storedDocument.update({ where: { id: document.id }, data: { analysisStatus: 'PROCESSING', analysisStartedAt: new Date(), analysisAttempts: { increment: 1 } } });
    await auditDocument({ userId: document.userId, documentId: document.id, operation: 'DOCUMENT_ANALYSIS_STARTED', source: 'system', entityType: 'document', entityId: document.id });
    const content = await documentStorage().get(document.storageKey); const text = await new OpenAITemporaryTextExtractor().extract({ content, fileName: document.originalFileName, mimeType: document.detectedMimeType || document.mimeType }); const preview = await new OpenAIContractDataExtractor().extract(text); const validation = contractPreviewValidator.validate(preview);
    const previewKey = `document-preview:${document.id}:v${document.analysisVersion}`;
    const committed = await prisma.$transaction(async (tx) => {
      const ownership = await tx.documentAnalysisJob.updateMany({ where: { id: job.id, status: 'PROCESSING', lockedBy: runnerId }, data: { status: 'COMPLETED', lockedAt: null, lockedBy: null } });
      if (!ownership.count) return null;
      const existingProposal = await tx.documentImportProposal.findFirst({ where: { idempotencyKey: previewKey }, select: { id: true } });
      const proposal = await tx.documentImportProposal.upsert({ where: { idempotencyKey: previewKey }, create: { userId: document.userId, documentId: document.id, analysisVersion: document.analysisVersion, idempotencyKey: previewKey, status: validation.valid ? 'READY_FOR_REVIEW' : 'PENDING', extractedData: preview as unknown as Prisma.InputJsonValue, validationWarnings: validation.warnings }, update: { extractedData: preview as unknown as Prisma.InputJsonValue, validationWarnings: validation.warnings, status: validation.valid ? 'READY_FOR_REVIEW' : 'PENDING' } });
      await tx.storedDocument.update({ where: { id: document.id }, data: { analysisStatus: validation.valid ? 'COMPLETED' : 'NEEDS_REVIEW', analysisCompletedAt: new Date(), analysisErrorCode: null, analysisErrorMessage: null } });
      return { proposal, existingProposal };
    });
    if (!committed) return { jobId: job.id, skipped: true };
    const { proposal, existingProposal } = committed;
    await auditDocument({ userId: document.userId, documentId: document.id, proposalId: proposal.id, operation: existingProposal ? 'PREVIEW_UPDATED' : 'PREVIEW_CREATED', source: 'system', entityType: 'document_preview', entityId: proposal.id, after: { valid: validation.valid, warnings: validation.warnings } });
    await auditDocument({ userId: document.userId, documentId: document.id, proposalId: proposal.id, operation: 'DOCUMENT_ANALYZED', source: 'system', entityType: 'document', entityId: document.id, after: { valid: validation.valid } }); return { jobId: job.id, proposalId: proposal.id };
  } catch (error) {
    const code = error instanceof DocumentError ? error.code : 'UNKNOWN';
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    const attempt = job.attempts + 1;
    const retry = error instanceof DocumentError && error.retryable && attempt < 3;
    const runAfter = retry ? new Date(Date.now() + 2 ** attempt * 60_000) : new Date();
    const released = await prisma.documentAnalysisJob.updateMany({ where: { id: job.id, status: 'PROCESSING', lockedBy: runnerId }, data: { status: retry ? 'QUEUED' : 'FAILED', runAfter, lastErrorCode: code, lastErrorMessage: message.slice(0, 500), lockedAt: null, lockedBy: null } });
    if (!released.count) return { jobId: job.id, skipped: true };
    await prisma.storedDocument.update({ where: { id: document.id }, data: { analysisStatus: retry ? 'QUEUED' : 'FAILED', analysisErrorCode: code, analysisErrorMessage: message.slice(0, 500) } });
    if (retry) await enqueueDocumentAnalysisJob(job.id).catch(() => undefined);
    await auditDocument({ userId: document.userId, documentId: document.id, operation: 'DOCUMENT_ANALYSIS_FAILED', source: 'system', entityType: 'document', entityId: document.id, after: { code, retry, attempt, ...(error instanceof DocumentError && error.diagnostics ? { diagnostics: error.diagnostics } : {}) } });
    return { jobId: job.id, failed: true, retry };
  }
}
