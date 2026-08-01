import { beforeEach, describe, expect, it, vi } from 'vitest';

const storedDocument = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};
const storageGet = vi.fn();
const storagePut = vi.fn();
const scanDocument = vi.fn();

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
    scanDocument,
    documentStorage: () => ({
      provider: 'LOCAL_DEVELOPMENT',
      get: storageGet,
      put: storagePut,
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
    storedDocument.create.mockReset();
    storedDocument.update.mockReset();
    storageGet.mockReset();
    storagePut.mockReset();
    scanDocument.mockReset();
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

  it('não libera download de documento sem scan CLEAN', async () => {
    storedDocument.findFirst.mockResolvedValue({
      id: 'documento-pendente', storageKey: 'documents/user-a/pending.pdf',
      storageStatus: 'AVAILABLE', scanStatus: 'PENDING',
    });
    const { openDocument } = await import('../persistent-document.service');
    await expect(openDocument('user-a', 'documento-pendente')).rejects.toMatchObject({ code: 'SECURITY_SCAN_PENDING' });
    expect(storageGet).not.toHaveBeenCalled();
  });

  it('não enfileira IA para documento sem scan CLEAN', async () => {
    storedDocument.findFirst.mockResolvedValue({ id: 'documento-pendente', scanStatus: 'FAILED' });
    const { enqueueDocumentAnalysis } = await import('../persistent-document.service');
    await expect(enqueueDocumentAnalysis('user-a', 'documento-pendente')).rejects.toMatchObject({ code: 'SECURITY_SCAN_PENDING' });
  });

  it('não envia arquivo infectado ao storage privado', async () => {
    storedDocument.findFirst.mockResolvedValue(undefined);
    storedDocument.create.mockResolvedValue({ id: 'infectado', originalFileName: 'fixture.txt' });
    storedDocument.update.mockResolvedValue({ id: 'infectado' });
    scanDocument.mockResolvedValue({ status: 'INFECTED', details: { scanner: 'clamav', reason: 'scanner_detected_threat' } });
    const { uploadDocument } = await import('../persistent-document.service');
    const file = new File(['conteudo sintetico suspeito'], 'fixture.txt', { type: 'text/plain' });

    await expect(uploadDocument('user-a', file)).rejects.toMatchObject({ code: 'SECURITY_SCAN_INFECTED' });
    expect(storagePut).not.toHaveBeenCalled();
    expect(storedDocument.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'infectado' },
      data: expect.objectContaining({ storageStatus: 'QUARANTINED', scanStatus: 'INFECTED' }),
    }));
  });
});
