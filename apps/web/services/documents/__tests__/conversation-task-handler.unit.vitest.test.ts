import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `resolveDocumentConversationTaskAction` — handler de resolução de
 * `ConversationTask` para documentos (Fase E — "NOVA como centro da
 * experiência"). Cobre a prioridade máxima da fase: "cadastrar_financiamento"
 * SÓ chama `confirmDocumentProposal` (`DocumentProposalConfirmationService`)
 * — nenhum outro caminho cria parcelamento — e nunca executa sem conta e
 * categoria.
 */

const confirmDocumentProposal = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('../document-proposal-confirmation.service', async () => {
  const actual = await vi.importActual<typeof import('../document-proposal-confirmation.service')>('../document-proposal-confirmation.service');
  return { ConfirmationError: actual.ConfirmationError, confirmDocumentProposal };
});
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/services/modules', () => ({ PersistentFinanceService: class {} }));
vi.mock('@/services/modules/finance/finance-user-context', () => ({ runAsFinanceUser: vi.fn() }));
vi.mock('@/services/repositories', () => ({ PrismaFinanceRepository: class {} }));

function baseTask(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'task-a',
    userId: 'user-a',
    type: 'DOCUMENT_ANALYSIS_COMPLETED',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    title: 'Financiamento identificado',
    message: 'Identifiquei um financiamento. Quer cadastrar?',
    payload: { proposalId: 'preview-a' },
    actions: [],
    sourceType: 'document_import_proposal',
    sourceId: 'preview-a',
    idempotencyKey: 'conversation-task:document-analysis:doc-a:v1',
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    dismissedAt: null,
    ...overrides,
  } as never;
}

describe('resolveDocumentConversationTaskAction', () => {
  beforeEach(() => {
    confirmDocumentProposal.mockReset();
  });

  it('sourceType diferente de document_import_proposal devolve null (produtor futuro passa direto)', async () => {
    const { resolveDocumentConversationTaskAction } = await import('../conversation-task-handler');
    const result = await resolveDocumentConversationTaskAction(baseTask({ sourceType: 'email_received' }), 'qualquer_acao', 'user-a', {});
    expect(result).toBeNull();
    expect(confirmDocumentProposal).not.toHaveBeenCalled();
  });

  it('actionId não reconhecido devolve null (rota decide o fallback genérico)', async () => {
    const { resolveDocumentConversationTaskAction } = await import('../conversation-task-handler');
    const result = await resolveDocumentConversationTaskAction(baseTask(), 'acao_desconhecida', 'user-a', {});
    expect(result).toBeNull();
    expect(confirmDocumentProposal).not.toHaveBeenCalled();
  });

  it('cadastrar_financiamento sem accountId/categoryId nunca chama o service financeiro', async () => {
    const { resolveDocumentConversationTaskAction } = await import('../conversation-task-handler');
    const { ConfirmationError } = await import('../document-proposal-confirmation.service');
    await expect(resolveDocumentConversationTaskAction(baseTask(), 'cadastrar_financiamento', 'user-a', {}))
      .rejects.toBeInstanceOf(ConfirmationError);
    expect(confirmDocumentProposal).not.toHaveBeenCalled();
  });

  it('cadastrar_financiamento sem proposalId no payload nunca chama o service financeiro', async () => {
    const { resolveDocumentConversationTaskAction } = await import('../conversation-task-handler');
    await expect(resolveDocumentConversationTaskAction(
      baseTask({ payload: {} }),
      'cadastrar_financiamento',
      'user-a',
      { accountId: 'account-a', categoryId: 'category-a' }
    )).rejects.toMatchObject({ status: 422 });
    expect(confirmDocumentProposal).not.toHaveBeenCalled();
  });

  it('cadastrar_financiamento com conta e categoria chama SOMENTE confirmDocumentProposal', async () => {
    confirmDocumentProposal.mockResolvedValue({ alreadyConfirmed: false, installmentGroupId: 'group-a', message: 'Parcelamento criado.' });
    const { resolveDocumentConversationTaskAction } = await import('../conversation-task-handler');
    const result = await resolveDocumentConversationTaskAction(
      baseTask(),
      'cadastrar_financiamento',
      'user-a',
      { accountId: 'account-a', categoryId: 'category-a', startDate: '2030-01-10' }
    );
    expect(confirmDocumentProposal).toHaveBeenCalledTimes(1);
    expect(confirmDocumentProposal).toHaveBeenCalledWith({
      proposalId: 'preview-a',
      userId: 'user-a',
      accountId: 'account-a',
      categoryId: 'category-a',
      startDate: '2030-01-10',
    });
    expect(result).toMatchObject({ financial: true, installmentGroupId: 'group-a' });
  });

  it('proposta já confirmada antes (idempotência) nunca duplica e narra sem criar de novo', async () => {
    confirmDocumentProposal.mockResolvedValue({ alreadyConfirmed: true, installmentGroupId: 'group-a', message: 'Já confirmada.' });
    const { resolveDocumentConversationTaskAction } = await import('../conversation-task-handler');
    const result = await resolveDocumentConversationTaskAction(
      baseTask(),
      'cadastrar_financiamento',
      'user-a',
      { accountId: 'account-a', categoryId: 'category-a' }
    );
    expect(result?.reply).toContain('já tinha sido cadastrado');
    expect(result?.alreadyConfirmed).toBe(true);
  });

  it('guardar_documento/revisar_documento/ver_documento nunca chamam o service financeiro', async () => {
    const { resolveDocumentConversationTaskAction } = await import('../conversation-task-handler');
    for (const actionId of ['guardar_documento', 'revisar_documento', 'ver_documento']) {
      const result = await resolveDocumentConversationTaskAction(baseTask(), actionId, 'user-a', {});
      expect(result?.financial).toBe(false);
    }
    expect(confirmDocumentProposal).not.toHaveBeenCalled();
  });
});
