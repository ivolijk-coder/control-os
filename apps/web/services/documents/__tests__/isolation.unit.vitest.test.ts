import { beforeEach, describe, expect, it, vi } from 'vitest';

const storedDocument = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
};
const storageGet = vi.fn();

vi.mock('@prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code = 'P2002';
    },
  },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    storedDocument,
    documentAuditEvent: { create: vi.fn() },
  },
}));
vi.mock('../document-core', async (importOriginal) => {
  const original = await importOriginal<typeof import('../document-core')>();
  return {
    ...original,
    documentStorage: () => ({
      provider: 'LOCAL_DEVELOPMENT',
      get: storageGet,
      put: vi.fn(),
      remove: vi.fn(),
      exists: vi.fn(),
    }),
  };
});
vi.mock('../document-analysis-queue', () => ({ enqueueDocumentAnalysisJob: vi.fn() }));

describe('isolamento entre usuários', () => {
  beforeEach(() => {
    storedDocument.findMany.mockReset();
    storedDocument.findFirst.mockReset();
    storageGet.mockReset();
  });

  it('sempre inclui o usuário autenticado ao listar documentos', async () => {
    storedDocument.findMany.mockResolvedValue([]);
    const { listDocuments } = await import('../persistent-document.service');
    await listDocuments('user-a');
    await listDocuments('user-b');
    expect(storedDocument.findMany.mock.calls[0]?.[0].where.userId).toBe('user-a');
    expect(storedDocument.findMany.mock.calls[1]?.[0].where.userId).toBe('user-b');
  });

  it('não abre nem baixa documento pertencente a outro usuário', async () => {
    storedDocument.findFirst.mockResolvedValue(undefined);
    const { openDocument } = await import('../persistent-document.service');
    await expect(openDocument('user-a', 'documento-de-user-b')).resolves.toBeUndefined();
    expect(storedDocument.findFirst).toHaveBeenCalledWith({
      where: { id: 'documento-de-user-b', userId: 'user-a', archivedAt: null },
    });
    expect(storageGet).not.toHaveBeenCalled();
  });

  it('não permite enfileirar análise manipulando o ID de outro usuário', async () => {
    storedDocument.findFirst.mockResolvedValue(undefined);
    const { enqueueDocumentAnalysis } = await import('../persistent-document.service');
    await expect(enqueueDocumentAnalysis('user-a', 'documento-de-user-b')).resolves.toBeUndefined();
    expect(storedDocument.findFirst).toHaveBeenCalledWith({
      where: { id: 'documento-de-user-b', userId: 'user-a', archivedAt: null },
    });
  });
});
