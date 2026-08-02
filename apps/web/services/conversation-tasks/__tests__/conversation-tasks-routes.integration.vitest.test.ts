import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Rotas de `ConversationTask` consumidas pela NOVA (Fase D — "NOVA como
 * centro da experiência"). Cobre a garantia explícita pedida nesta fase:
 * clique duplo, refresh ou mensagem repetida nunca resolvem/descartam a
 * mesma task duas vezes — a mesma idempotência que
 * `DocumentProposalConfirmationService` já garante, agora também na borda
 * HTTP que a NOVA chama.
 *
 * Vive em `services/conversation-tasks/__tests__` (não junto das rotas em
 * `app/api/`) porque `vitest.config.ts` só inclui `services/**` e
 * `tests/**` — mesmo padrão já usado por
 * `services/documents/__tests__/confirmation.integration.vitest.test.ts`,
 * que testa `app/api/documents/proposals/[id]/confirm/route.ts` do mesmo
 * jeito.
 */

type TaskState = 'PENDING' | 'IN_PROGRESS' | 'WAITING_USER' | 'COMPLETED' | 'DISMISSED';

let tasks: Record<string, { id: string; userId: string; status: TaskState; sourceType?: string; payload?: Record<string, unknown> }>;
let currentUserId: string | null;
const auditCalls: Array<{ operation: string; entityId: string }> = [];

// `confirmDocumentProposal` (Fase E): mockado no MESMO nível que o teste de
// unidade de `conversation-task-handler.unit.vitest.test.ts` — aqui o
// objetivo não é reverificar as regras do service financeiro (já cobertas
// lá e em `document-proposal-confirmation.service.unit.vitest.test.ts`),
// e sim provar que a ROTA HTTP chega até ele através do handler real
// (`resolveDocumentConversationTaskAction`, nunca mockado neste arquivo) e
// que os eventos de auditoria/idempotência na borda HTTP estão corretos.
const confirmDocumentProposal = vi.fn();

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}));
vi.mock('@/services/auth/session', () => ({
  currentSessionUserId: vi.fn(() => currentUserId ?? undefined),
}));
vi.mock('@/services/documents/document-core', () => ({
  auditDocument: vi.fn(async (input: { operation: string; entityId: string }) => {
    auditCalls.push({ operation: input.operation, entityId: input.entityId });
    return 'correlation-id';
  }),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/services/modules', () => ({ PersistentFinanceService: class {} }));
vi.mock('@/services/modules/finance/finance-user-context', () => ({ runAsFinanceUser: vi.fn() }));
vi.mock('@/services/repositories', () => ({ PrismaFinanceRepository: class {} }));
vi.mock('@/services/documents/document-proposal-confirmation.service', async () => {
  const actual = await vi.importActual<typeof import('@/services/documents/document-proposal-confirmation.service')>('@/services/documents/document-proposal-confirmation.service');
  return { ConfirmationError: actual.ConfirmationError, confirmDocumentProposal };
});
vi.mock('@/services/conversation-tasks', () => ({
  listPendingConversationTasks: vi.fn(async (userId: string) =>
    Object.values(tasks).filter((task) => task.userId === userId && (task.status === 'PENDING' || task.status === 'WAITING_USER')).map((task) => ({
      ...task,
      type: 'DOCUMENT_ANALYSIS_COMPLETED',
      priority: 'HIGH',
      title: 'Financiamento identificado',
      message: 'Identifiquei um financiamento. Quer cadastrar?',
      actions: [{ id: 'cadastrar_financiamento', label: 'Cadastrar financiamento' }],
      createdAt: new Date('2030-01-01T00:00:00Z'),
    }))
  ),
  claimConversationTaskForResolution: vi.fn(async ({ id, userId }: { id: string; userId: string }) => {
    const task = tasks[id];
    if (!task || task.userId !== userId || !(task.status === 'PENDING' || task.status === 'WAITING_USER')) return null;
    task.status = 'IN_PROGRESS';
    return { ...task, type: 'DOCUMENT_ANALYSIS_COMPLETED', sourceType: task.sourceType, payload: task.payload ?? {} };
  }),
  completeConversationTask: vi.fn(async ({ id, userId }: { id: string; userId: string }) => {
    const task = tasks[id];
    if (!task || task.userId !== userId || task.status !== 'IN_PROGRESS') return false;
    task.status = 'COMPLETED';
    return true;
  }),
  revertConversationTaskToWaitingUser: vi.fn(async ({ id, userId }: { id: string; userId: string }) => {
    const task = tasks[id];
    if (!task || task.userId !== userId || task.status !== 'IN_PROGRESS') return false;
    task.status = 'WAITING_USER';
    return true;
  }),
  dismissConversationTask: vi.fn(async ({ id, userId }: { id: string; userId: string }) => {
    const task = tasks[id];
    if (!task || task.userId !== userId || !(task.status === 'PENDING' || task.status === 'WAITING_USER')) return false;
    task.status = 'DISMISSED';
    return true;
  }),
}));

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/nova/conversation-tasks/task-a/resolve', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('GET /api/nova/conversation-tasks', () => {
  beforeEach(() => {
    tasks = { 'task-a': { id: 'task-a', userId: 'user-a', status: 'PENDING' } };
    currentUserId = 'user-a';
    auditCalls.length = 0;
  });

  it('401 sem sessão', async () => {
    currentUserId = null;
    const { GET } = await import('@/app/api/nova/conversation-tasks/route');
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('lista tasks pendentes do usuário e audita CONVERSATION_TASK_PRESENTED', async () => {
    const { GET } = await import('@/app/api/nova/conversation-tasks/route');
    const response = await GET();
    expect(response.status).toBe(200);
    expect((response.body as unknown as { tasks: unknown[] }).tasks).toHaveLength(1);
    expect(auditCalls).toContainEqual({ operation: 'CONVERSATION_TASK_PRESENTED', entityId: 'task-a' });
  });
});

describe('POST /api/nova/conversation-tasks/:id/resolve — idempotência (clique duplo)', () => {
  beforeEach(() => {
    tasks = { 'task-a': { id: 'task-a', userId: 'user-a', status: 'PENDING' } };
    currentUserId = 'user-a';
    auditCalls.length = 0;
  });

  it('401 sem sessão', async () => {
    currentUserId = null;
    const { POST } = await import('@/app/api/nova/conversation-tasks/[id]/resolve/route');
    const response = await POST(jsonRequest({ actionId: 'cadastrar_financiamento' }), { params: { id: 'task-a' } });
    expect(response.status).toBe(401);
  });

  it('400 sem actionId', async () => {
    const { POST } = await import('@/app/api/nova/conversation-tasks/[id]/resolve/route');
    const response = await POST(jsonRequest({}), { params: { id: 'task-a' } });
    expect(response.status).toBe(400);
  });

  it('resolve com sucesso, audita CONVERSATION_TASK_USER_CONFIRMED e conclui a task', async () => {
    const { POST } = await import('@/app/api/nova/conversation-tasks/[id]/resolve/route');
    const response = await POST(jsonRequest({ actionId: 'cadastrar_financiamento' }), { params: { id: 'task-a' } });
    expect(response.status).toBe(200);
    expect(tasks['task-a']?.status).toBe('COMPLETED');
    expect(auditCalls).toContainEqual({ operation: 'CONVERSATION_TASK_USER_CONFIRMED', entityId: 'task-a' });
  });

  it('duas resoluções concorrentes da mesma task: só uma executa, a outra recebe 409', async () => {
    const { POST } = await import('@/app/api/nova/conversation-tasks/[id]/resolve/route');
    const [first, second] = await Promise.all([
      POST(jsonRequest({ actionId: 'cadastrar_financiamento' }), { params: { id: 'task-a' } }),
      POST(jsonRequest({ actionId: 'cadastrar_financiamento' }), { params: { id: 'task-a' } }),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    expect(tasks['task-a']?.status).toBe('COMPLETED');
  });

  it('task já resolvida: nova tentativa (refresh) recebe 409, nunca reexecuta', async () => {
    const { POST } = await import('@/app/api/nova/conversation-tasks/[id]/resolve/route');
    await POST(jsonRequest({ actionId: 'cadastrar_financiamento' }), { params: { id: 'task-a' } });
    const replay = await POST(jsonRequest({ actionId: 'cadastrar_financiamento' }), { params: { id: 'task-a' } });
    expect(replay.status).toBe(409);
  });
});

describe('POST /api/nova/conversation-tasks/:id/resolve — cadastrar_financiamento (Fase E)', () => {
  beforeEach(() => {
    tasks = {
      'task-a': {
        id: 'task-a',
        userId: 'user-a',
        status: 'WAITING_USER',
        sourceType: 'document_import_proposal',
        payload: { proposalId: 'preview-a' },
      },
    };
    currentUserId = 'user-a';
    auditCalls.length = 0;
    confirmDocumentProposal.mockReset();
  });

  it('chama SOMENTE confirmDocumentProposal (via o handler real) e audita DOCUMENT_PROPOSAL_CONFIRMED + FINANCIAL_ENTITY_CREATED com correlationId = id da task', async () => {
    confirmDocumentProposal.mockResolvedValue({ alreadyConfirmed: false, installmentGroupId: 'group-a', message: 'Parcelamento criado.' });
    const { POST } = await import('@/app/api/nova/conversation-tasks/[id]/resolve/route');
    const response = await POST(
      jsonRequest({ actionId: 'cadastrar_financiamento', accountId: 'account-a', categoryId: 'category-a' }),
      { params: { id: 'task-a' } }
    );

    expect(response.status).toBe(200);
    expect((response.body as unknown as { reply: string }).reply).toContain('Cadastrado');
    expect(tasks['task-a']?.status).toBe('COMPLETED');
    expect(confirmDocumentProposal).toHaveBeenCalledTimes(1);
    expect(confirmDocumentProposal).toHaveBeenCalledWith({
      proposalId: 'preview-a',
      userId: 'user-a',
      accountId: 'account-a',
      categoryId: 'category-a',
      startDate: undefined,
    });
    expect(auditCalls).toContainEqual({ operation: 'DOCUMENT_PROPOSAL_CONFIRMED', entityId: 'preview-a' });
    expect(auditCalls).toContainEqual({ operation: 'FINANCIAL_ENTITY_CREATED', entityId: 'group-a' });
  });

  it('sem accountId/categoryId: nunca chama confirmDocumentProposal e a task VOLTA pra WAITING_USER (não fica travada em IN_PROGRESS)', async () => {
    const { POST } = await import('@/app/api/nova/conversation-tasks/[id]/resolve/route');
    const response = await POST(jsonRequest({ actionId: 'cadastrar_financiamento' }), { params: { id: 'task-a' } });

    expect(response.status).toBe(400);
    expect(confirmDocumentProposal).not.toHaveBeenCalled();
    expect(tasks['task-a']?.status).toBe('WAITING_USER');
  });

  it('duas resoluções concorrentes no caminho financeiro (clique duplo): só uma chama confirmDocumentProposal, a outra recebe 409', async () => {
    confirmDocumentProposal.mockResolvedValue({ alreadyConfirmed: false, installmentGroupId: 'group-a', message: 'Parcelamento criado.' });
    const { POST } = await import('@/app/api/nova/conversation-tasks/[id]/resolve/route');
    const [first, second] = await Promise.all([
      POST(jsonRequest({ actionId: 'cadastrar_financiamento', accountId: 'account-a', categoryId: 'category-a' }), { params: { id: 'task-a' } }),
      POST(jsonRequest({ actionId: 'cadastrar_financiamento', accountId: 'account-a', categoryId: 'category-a' }), { params: { id: 'task-a' } }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    expect(confirmDocumentProposal).toHaveBeenCalledTimes(1);
    expect(tasks['task-a']?.status).toBe('COMPLETED');
  });

  it('proposta já confirmada antes (idempotência do service financeiro): responde 200 sem duplicar e NÃO audita FINANCIAL_ENTITY_CREATED de novo', async () => {
    confirmDocumentProposal.mockResolvedValue({ alreadyConfirmed: true, installmentGroupId: 'group-a', message: 'Esta prévia já havia sido confirmada.' });
    const { POST } = await import('@/app/api/nova/conversation-tasks/[id]/resolve/route');
    const response = await POST(
      jsonRequest({ actionId: 'cadastrar_financiamento', accountId: 'account-a', categoryId: 'category-a' }),
      { params: { id: 'task-a' } }
    );

    expect(response.status).toBe(200);
    expect((response.body as unknown as { reply: string }).reply).toContain('já tinha sido cadastrado');
    expect(auditCalls).toContainEqual({ operation: 'DOCUMENT_PROPOSAL_CONFIRMED', entityId: 'preview-a' });
    expect(auditCalls).not.toContainEqual({ operation: 'FINANCIAL_ENTITY_CREATED', entityId: 'group-a' });
  });

  it('replay depois de resolvida (refresh/mensagem repetida): segunda chamada recebe 409 e não chama confirmDocumentProposal de novo', async () => {
    confirmDocumentProposal.mockResolvedValue({ alreadyConfirmed: false, installmentGroupId: 'group-a', message: 'Parcelamento criado.' });
    const { POST } = await import('@/app/api/nova/conversation-tasks/[id]/resolve/route');
    await POST(jsonRequest({ actionId: 'cadastrar_financiamento', accountId: 'account-a', categoryId: 'category-a' }), { params: { id: 'task-a' } });
    const replay = await POST(jsonRequest({ actionId: 'cadastrar_financiamento', accountId: 'account-a', categoryId: 'category-a' }), { params: { id: 'task-a' } });

    expect(replay.status).toBe(409);
    expect(confirmDocumentProposal).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/nova/conversation-tasks/:id/dismiss', () => {
  beforeEach(() => {
    tasks = { 'task-a': { id: 'task-a', userId: 'user-a', status: 'PENDING' } };
    currentUserId = 'user-a';
    auditCalls.length = 0;
  });

  it('descarta com sucesso e audita CONVERSATION_TASK_DISMISSED', async () => {
    const { POST } = await import('@/app/api/nova/conversation-tasks/[id]/dismiss/route');
    const response = await POST(new Request('http://localhost', { method: 'POST' }), { params: { id: 'task-a' } });
    expect(response.status).toBe(200);
    expect(tasks['task-a']?.status).toBe('DISMISSED');
    expect(auditCalls).toContainEqual({ operation: 'CONVERSATION_TASK_DISMISSED', entityId: 'task-a' });
  });

  it('mensagem repetida (descartar de novo) não reexecuta: segunda chamada recebe 409', async () => {
    const { POST } = await import('@/app/api/nova/conversation-tasks/[id]/dismiss/route');
    await POST(new Request('http://localhost', { method: 'POST' }), { params: { id: 'task-a' } });
    const second = await POST(new Request('http://localhost', { method: 'POST' }), { params: { id: 'task-a' } });
    expect(second.status).toBe(409);
    expect(auditCalls.filter((call) => call.operation === 'CONVERSATION_TASK_DISMISSED')).toHaveLength(1);
  });
});
