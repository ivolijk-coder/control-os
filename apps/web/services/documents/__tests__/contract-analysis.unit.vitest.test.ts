import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYNTHETIC_CONTRACT_PREVIEW } from './fixtures';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('../document-analysis-queue', () => ({
  dequeueDocumentAnalysisJobSafely: vi.fn(),
  enqueueDocumentAnalysisJob: vi.fn(),
}));

describe('preview de contrato', () => {
  it('aceita preview sintética completa', async () => {
    const { contractPreviewValidator } = await import('../contract-analysis');
    expect(contractPreviewValidator.validate(SYNTHETIC_CONTRACT_PREVIEW)).toEqual({
      valid: true,
      warnings: [],
    });
  });

  it('mantém preview incompleta para revisão sem inventar campos', async () => {
    const { contractPreviewValidator } = await import('../contract-analysis');
    const result = contractPreviewValidator.validate({
      ...SYNTHETIC_CONTRACT_PREVIEW,
      creditorName: null,
      totalAmount: null,
      installmentAmount: null,
      installments: null,
      missingFields: ['totalAmount'],
    });
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('totalAmount');
    expect(result.warnings).toContain('Credor não identificado.');
  });
});

describe('retry, backoff e limite de jobs', () => {
  it('aplica backoff exponencial determinístico', async () => {
    const { documentAnalysisBackoffMs } = await import('../contract-analysis');
    expect(documentAnalysisBackoffMs(1)).toBe(120_000);
    expect(documentAnalysisBackoffMs(2)).toBe(240_000);
  });

  it('repete erro temporário abaixo do limite e encerra no limite', async () => {
    const { DocumentError } = await import('../document-core');
    const { shouldRetryDocumentAnalysis, MAX_DOCUMENT_ANALYSIS_ATTEMPTS } = await import('../contract-analysis');
    const temporary = new DocumentError('PROVIDER_TIMEOUT', 'timeout', true);
    expect(shouldRetryDocumentAnalysis(temporary, 1)).toBe(true);
    expect(shouldRetryDocumentAnalysis(temporary, MAX_DOCUMENT_ANALYSIS_ATTEMPTS)).toBe(false);
  });

  it('não repete erro permanente', async () => {
    const { DocumentError } = await import('../document-core');
    const { shouldRetryDocumentAnalysis } = await import('../contract-analysis');
    expect(shouldRetryDocumentAnalysis(new DocumentError('INVALID_FILE', 'inválido'), 1)).toBe(false);
  });
});

// decideDocumentAction() é o único portão consultado pelo worker
// (processNextDocumentAnalysisJob) para decidir o status gravado em
// DocumentImportProposal: 'ARCHIVE' -> status ARCHIVED (guardado com
// classificação/resumo, sem proposta acionável, nunca confirmável);
// 'CREATE_FINANCIAL_PROPOSAL' -> status READY_FOR_REVIEW (ou PENDING se a
// validação financeira falhar) e uma proposta de fato é criada;
// 'ASK_USER' -> status READY_FOR_REVIEW, mas sem validação financeira —
// o usuário precisa confirmar manualmente se é uma operação financeira.
describe('decideDocumentAction: destino de um documento classificado', () => {
  it('Contrato Social com capital declarado -> ARCHIVE (status ARCHIVED, sem proposta financeira)', async () => {
    const { decideDocumentAction, isFinancialInstallmentProposal } = await import('../contract-analysis');
    const contratoSocial = {
      ...SYNTHETIC_CONTRACT_PREVIEW,
      documentType: 'CONTRACT_SOCIAL' as const,
      documentIntent: 'ARCHIVE_ONLY' as const,
      confidence: 'high' as const,
      financialOperation: { detected: false, type: null, creditor: null, amount: null, installments: null },
      creditorName: null,
      totalAmount: 30_000,
      installmentAmount: null,
      installments: null,
      summary: 'Constituição da sociedade CONTROL MARKETING DIGITAL LTDA, capital social de R$ 30.000,00.',
    };
    expect(decideDocumentAction(contratoSocial)).toBe('ARCHIVE');
    expect(isFinancialInstallmentProposal(contratoSocial)).toBe(false);
  });

  it('Financiamento com credor, valor e parcelas claros -> CREATE_FINANCIAL_PROPOSAL (status READY_FOR_REVIEW, cria proposta)', async () => {
    const { decideDocumentAction, isFinancialInstallmentProposal } = await import('../contract-analysis');
    const financiamento = {
      ...SYNTHETIC_CONTRACT_PREVIEW,
      documentType: 'FINANCING_CONTRACT' as const,
      documentIntent: 'FINANCIAL_ACTION_REQUIRED' as const,
      confidence: 'high' as const,
      financialOperation: { detected: true, type: 'FINANCIAMENTO', creditor: 'Banco X', amount: 120_000, installments: 48 },
      creditorName: 'Banco X',
      totalAmount: 120_000,
      installments: 48,
      interestRate: 1.5,
    };
    expect(decideDocumentAction(financiamento)).toBe('CREATE_FINANCIAL_PROPOSAL');
    expect(isFinancialInstallmentProposal(financiamento)).toBe(true);
  });

  it('Recibo simples sem operação de crédito -> ARCHIVE (status ARCHIVED)', async () => {
    const { decideDocumentAction, isFinancialInstallmentProposal } = await import('../contract-analysis');
    const recibo = {
      ...SYNTHETIC_CONTRACT_PREVIEW,
      documentType: 'RECEIPT' as const,
      documentIntent: 'EXTRACT_INFORMATION' as const,
      confidence: 'high' as const,
      financialOperation: { detected: false, type: null, creditor: null, amount: null, installments: null },
      creditorName: null,
      totalAmount: 500,
      installments: null,
      summary: 'Recibo de pagamento avulso, sem parcelamento.',
    };
    expect(decideDocumentAction(recibo)).toBe('ARCHIVE');
    expect(isFinancialInstallmentProposal(recibo)).toBe(false);
  });

  it('Documento ambíguo (intenção financeira sem dados mínimos de crédito) -> ASK_USER (status READY_FOR_REVIEW, sem inventar)', async () => {
    const { decideDocumentAction, isFinancialInstallmentProposal } = await import('../contract-analysis');
    const ambiguo = {
      ...SYNTHETIC_CONTRACT_PREVIEW,
      documentType: 'LEGAL_DOCUMENT' as const,
      documentIntent: 'FINANCIAL_ACTION_REQUIRED' as const,
      confidence: 'medium' as const,
      financialOperation: { detected: true, type: 'PRESTACAO_SERVICO', creditor: null, amount: null, installments: null },
      creditorName: null,
      totalAmount: null,
      installments: null,
      summary: 'Contrato de prestação de serviço recorrente, sem valor total nem número de parcelas definidos.',
    };
    expect(decideDocumentAction(ambiguo)).toBe('ASK_USER');
    expect(isFinancialInstallmentProposal(ambiguo)).toBe(false);
  });

  it('confiança baixa nunca é resolvida por adivinhação -> ASK_USER mesmo com dados financeiros aparentemente completos', async () => {
    const { decideDocumentAction } = await import('../contract-analysis');
    const baixaConfianca = {
      ...SYNTHETIC_CONTRACT_PREVIEW,
      documentIntent: 'FINANCIAL_ACTION_REQUIRED' as const,
      confidence: 'low' as const,
    };
    expect(decideDocumentAction(baixaConfianca)).toBe('ASK_USER');
  });

  it('fecha por padrão quando a IA marca financialOperation.detected=true mas faltam dados mínimos de crédito', async () => {
    const { isFinancialInstallmentProposal } = await import('../contract-analysis');
    const incompleto = {
      ...SYNTHETIC_CONTRACT_PREVIEW,
      financialOperation: { ...SYNTHETIC_CONTRACT_PREVIEW.financialOperation, detected: true },
      creditorName: null,
    };
    expect(isFinancialInstallmentProposal(incompleto)).toBe(false);
  });
});

// buildDocumentConversationTaskContent() é o que processNextDocumentAnalysisJob
// usa pra montar a ConversationTask (Fase C — "NOVA como centro da
// experiência") dentro da MESMA transação que grava o DocumentImportProposal.
// actions sempre no shape genérico { id, label } — nada específico de
// Documentos vaza pra fora do payload/actions.
describe('buildDocumentConversationTaskContent: conteúdo da ConversationTask por decisão', () => {
  it('CREATE_FINANCIAL_PROPOSAL com dados válidos -> prioridade HIGH e ação de cadastro', async () => {
    const { buildDocumentConversationTaskContent } = await import('../contract-analysis');
    const content = buildDocumentConversationTaskContent(SYNTHETIC_CONTRACT_PREVIEW, 'CREATE_FINANCIAL_PROPOSAL', true);
    expect(content.priority).toBe('HIGH');
    expect(content.message).toContain('Credor Sintético');
    expect(content.message).toContain('12x');
    expect(content.actions.map((action) => action.id)).toEqual(['cadastrar_financiamento', 'guardar_documento']);
  });

  it('ASK_USER -> prioridade MEDIUM e ação de revisão, nunca de cadastro direto', async () => {
    const { buildDocumentConversationTaskContent } = await import('../contract-analysis');
    const content = buildDocumentConversationTaskContent({ ...SYNTHETIC_CONTRACT_PREVIEW, documentType: 'LEGAL_DOCUMENT' }, 'ASK_USER', false);
    expect(content.priority).toBe('MEDIUM');
    expect(content.actions.map((action) => action.id)).toEqual(['revisar_documento', 'guardar_documento']);
    expect(content.actions.some((action) => action.id === 'cadastrar_financiamento')).toBe(false);
  });

  it('CREATE_FINANCIAL_PROPOSAL com dados financeiros insuficientes cai na mesma trilha de ASK_USER', async () => {
    const { buildDocumentConversationTaskContent } = await import('../contract-analysis');
    const content = buildDocumentConversationTaskContent(SYNTHETIC_CONTRACT_PREVIEW, 'CREATE_FINANCIAL_PROPOSAL', false);
    expect(content.priority).toBe('MEDIUM');
    expect(content.actions.some((action) => action.id === 'cadastrar_financiamento')).toBe(false);
  });

  it('ARCHIVE -> prioridade LOW, sem ação financeira, só a de visualizar', async () => {
    const { buildDocumentConversationTaskContent } = await import('../contract-analysis');
    const content = buildDocumentConversationTaskContent({ ...SYNTHETIC_CONTRACT_PREVIEW, documentType: 'CONTRACT_SOCIAL' }, 'ARCHIVE', false);
    expect(content.priority).toBe('LOW');
    expect(content.actions).toEqual([{ id: 'ver_documento', label: 'Ver documento' }]);
  });
});

describe('OpenAI opt-in', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_DOCUMENT_ANALYSIS_ENABLED', 'false');
    vi.stubEnv('OPENAI_API_KEY', 'não-deve-ser-usada');
  });

  it('não chama rede quando análise real está desativada', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { OpenAITemporaryTextExtractor } = await import('../contract-analysis');
    await expect(new OpenAITemporaryTextExtractor().extract({
      content: Buffer.from('sintético'),
      fileName: 'sintetico.pdf',
      mimeType: 'application/pdf',
    })).rejects.toMatchObject({ code: 'MODEL_UNSUPPORTED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
