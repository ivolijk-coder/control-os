import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `getDocumentAnalysisProgress` (Fase F — "NOVA como centro da
 * experiência"): leitura barata pra polling curto. Cobre a garantia
 * principal desta fase — a consulta é sempre escopada por `userId`, nunca
 * vaza progresso de um documento de outro usuário — e o caso sem job
 * (análise nunca pedida), que não pode quebrar a leitura.
 */

type StoredDocumentRow = { id: string; userId: string; analysisStatus: string; analysisVersion: number; analysisErrorCode: string | null; analysisErrorMessage: string | null };
type JobRow = { status: string; progressStage: string };

let documents: Record<string, StoredDocumentRow>;
let jobs: JobRow[];

vi.mock('@prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code = 'P2002';
    },
  },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    storedDocument: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
        const document = documents[where.id];
        if (!document || document.userId !== where.userId) return null;
        return document;
      }),
    },
    documentAnalysisJob: {
      findFirst: vi.fn(async ({ where }: { where: { documentId: string; analysisVersion: number } }) => {
        void where;
        return jobs[0] ?? null;
      }),
    },
  },
}));
vi.mock('../document-analysis-queue', () => ({ enqueueDocumentAnalysisJob: vi.fn() }));
vi.mock('../document-core', () => ({
  auditDocument: vi.fn(),
  documentStorage: vi.fn(),
  DocumentError: class DocumentError extends Error {},
  newStorageKey: vi.fn(),
  scanDocument: vi.fn(),
  validateUploadedDocument: vi.fn(),
}));

describe('getDocumentAnalysisProgress', () => {
  beforeEach(() => {
    documents = {
      'document-a': { id: 'document-a', userId: 'user-a', analysisStatus: 'PROCESSING', analysisVersion: 1, analysisErrorCode: null, analysisErrorMessage: null },
    };
    jobs = [{ status: 'PROCESSING', progressStage: 'IDENTIFYING_TYPE' }];
  });

  it('documento inexistente devolve undefined', async () => {
    const { getDocumentAnalysisProgress } = await import('../persistent-document.service');
    expect(await getDocumentAnalysisProgress('user-a', 'document-x')).toBeUndefined();
  });

  it('documento de outro usuário devolve undefined (nunca vaza progresso alheio)', async () => {
    const { getDocumentAnalysisProgress } = await import('../persistent-document.service');
    expect(await getDocumentAnalysisProgress('user-b', 'document-a')).toBeUndefined();
  });

  it('devolve analysisStatus + progressStage/jobStatus do job da versão atual', async () => {
    const { getDocumentAnalysisProgress } = await import('../persistent-document.service');
    const progress = await getDocumentAnalysisProgress('user-a', 'document-a');
    expect(progress).toEqual({
      documentId: 'document-a',
      analysisStatus: 'PROCESSING',
      progressStage: 'IDENTIFYING_TYPE',
      jobStatus: 'PROCESSING',
      errorCode: null,
      errorMessage: null,
    });
  });

  it('análise nunca pedida (sem job pra esta versão): progressStage/jobStatus vêm null, nunca quebra', async () => {
    documents['document-a']!.analysisStatus = 'NOT_REQUESTED';
    jobs = [];
    const { getDocumentAnalysisProgress } = await import('../persistent-document.service');
    const progress = await getDocumentAnalysisProgress('user-a', 'document-a');
    expect(progress).toMatchObject({ analysisStatus: 'NOT_REQUESTED', progressStage: null, jobStatus: null });
  });

  it('repassa erro (analysisErrorCode/analysisErrorMessage) quando a análise falhou', async () => {
    documents['document-a']!.analysisStatus = 'FAILED';
    documents['document-a']!.analysisErrorCode = 'PROVIDER_TIMEOUT';
    documents['document-a']!.analysisErrorMessage = 'A análise demorou mais do que o permitido.';
    jobs = [{ status: 'FAILED', progressStage: 'FAILED' }];
    const { getDocumentAnalysisProgress } = await import('../persistent-document.service');
    const progress = await getDocumentAnalysisProgress('user-a', 'document-a');
    expect(progress).toMatchObject({ errorCode: 'PROVIDER_TIMEOUT', errorMessage: 'A análise demorou mais do que o permitido.', progressStage: 'FAILED' });
  });
});
