import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `GET /api/documents/:id/analysis-progress` (Fase F — "NOVA como centro
 * da experiência"). Vive em `services/documents/__tests__` (não em
 * `app/api/`) pelo mesmo motivo dos outros testes de rota deste projeto —
 * `vitest.config.ts` só inclui `services/**` e `tests/**` (ver
 * `services/conversation-tasks/__tests__/conversation-tasks-routes.integration.vitest.test.ts`).
 */

let currentUserId: string | null;
const getDocumentAnalysisProgress = vi.fn();

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}));
vi.mock('@/services/auth/session', () => ({
  currentSessionUserId: vi.fn(() => currentUserId ?? undefined),
}));
vi.mock('@/services/documents/persistent-document.service', () => ({ getDocumentAnalysisProgress }));

describe('GET /api/documents/:id/analysis-progress', () => {
  beforeEach(() => {
    currentUserId = 'user-a';
    getDocumentAnalysisProgress.mockReset();
  });

  it('401 sem sessão — nunca consulta o progresso de ninguém', async () => {
    currentUserId = null;
    const { GET } = await import('@/app/api/documents/[id]/analysis-progress/route');
    const response = await GET(new Request('http://localhost'), { params: { id: 'document-a' } });
    expect(response.status).toBe(401);
    expect(getDocumentAnalysisProgress).not.toHaveBeenCalled();
  });

  it('404 quando o documento não existe (ou é de outro usuário)', async () => {
    getDocumentAnalysisProgress.mockResolvedValue(undefined);
    const { GET } = await import('@/app/api/documents/[id]/analysis-progress/route');
    const response = await GET(new Request('http://localhost'), { params: { id: 'document-x' } });
    expect(response.status).toBe(404);
  });

  it('200 repassa o progresso, escopado ao usuário da sessão', async () => {
    getDocumentAnalysisProgress.mockResolvedValue({
      documentId: 'document-a', analysisStatus: 'PROCESSING', progressStage: 'EXTRACTING_DATA', jobStatus: 'PROCESSING', errorCode: null, errorMessage: null,
    });
    const { GET } = await import('@/app/api/documents/[id]/analysis-progress/route');
    const response = await GET(new Request('http://localhost'), { params: { id: 'document-a' } });
    expect(response.status).toBe(200);
    expect((response.body as unknown as { progressStage: string }).progressStage).toBe('EXTRACTING_DATA');
    expect(getDocumentAnalysisProgress).toHaveBeenCalledWith('user-a', 'document-a');
  });
});
