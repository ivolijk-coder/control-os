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
