import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `ConversationTaskService` — cobre a garantia explícita pedida na Fase
 * A-F: "ConversationTask + proposal + confirmation não podem executar
 * duas vezes em clique duplo, refresh ou mensagem repetida". Dois pontos
 * de idempotência são testados isoladamente: criação (mesmo
 * `idempotencyKey` nunca gera duas linhas, nunca regride uma task já
 * resolvida) e resolução (claim atômico nunca deixa duas chamadas
 * concorrentes passarem).
 */

type TaskState = { status: string; completedAt: Date | null; dismissedAt: Date | null };

let tasks: Record<string, TaskState & { id: string; userId: string; title: string; message: string; payload: unknown; actions: unknown; priority: string }>;

const conversationTaskClient = {
  findFirst: vi.fn(async ({ where }: { where: { idempotencyKey?: string; id?: string; userId?: string } }) => {
    if (where.idempotencyKey) {
      const found = Object.values(tasks).find((task) => task.id === where.idempotencyKey || (task as unknown as { idempotencyKey?: string }).idempotencyKey === where.idempotencyKey);
      return found ?? null;
    }
    if (where.id) {
      const found = tasks[where.id];
      if (!found || (where.userId && found.userId !== where.userId)) return null;
      return found;
    }
    return null;
  }),
  upsert: vi.fn(async ({ where, create, update }: { where: { idempotencyKey: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
    const existingId = Object.keys(tasks).find((id) => (tasks[id] as unknown as { idempotencyKey?: string }).idempotencyKey === where.idempotencyKey);
    if (existingId) {
      tasks[existingId] = { ...tasks[existingId], ...update } as typeof tasks[string];
      return tasks[existingId];
    }
    const id = `task-${Object.keys(tasks).length + 1}`;
    tasks[id] = {
      id,
      userId: create.userId as string,
      status: 'PENDING',
      completedAt: null,
      dismissedAt: null,
      title: create.title as string,
      message: create.message as string,
      payload: create.payload,
      actions: create.actions,
      priority: create.priority as string,
      ...({ idempotencyKey: where.idempotencyKey } as unknown as Record<string, unknown>),
    } as typeof tasks[string];
    return tasks[id];
  }),
  updateMany: vi.fn(async ({ where, data }: { where: { id: string; userId: string; status: string | { in: string[] } }; data: Record<string, unknown> }) => {
    const task = tasks[where.id];
    if (!task || task.userId !== where.userId) return { count: 0 };
    const allowed = typeof where.status === 'string' ? [where.status] : where.status.in;
    if (!allowed.includes(task.status)) return { count: 0 };
    Object.assign(task, data);
    return { count: 1 };
  }),
  findMany: vi.fn(async ({ where }: { where: { userId: string; status: { in: string[] } } }) => {
    return Object.values(tasks).filter((task) => task.userId === where.userId && where.status.in.includes(task.status));
  }),
};

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({
  prisma: { conversationTask: conversationTaskClient },
}));

function baseInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    userId: 'user-a',
    type: 'DOCUMENT_ANALYSIS_COMPLETED' as const,
    priority: 'HIGH' as const,
    title: 'Financiamento identificado',
    message: 'Identifiquei um financiamento Caixa de R$ 686.000 em 360 meses. Quer cadastrar?',
    payload: { proposalId: 'preview-a' },
    actions: [
      { id: 'cadastrar_financiamento', label: 'Cadastrar financiamento' },
      { id: 'guardar_documento', label: 'Só guardar' },
      { id: 'depois', label: 'Depois' },
    ],
    sourceType: 'document_import_proposal',
    sourceId: 'preview-a',
    idempotencyKey: 'conversation-task:document-analysis:document-a:v1',
    ...overrides,
  };
}

describe('createConversationTask — idempotência de criação', () => {
  beforeEach(() => {
    tasks = {};
    conversationTaskClient.findFirst.mockClear();
    conversationTaskClient.upsert.mockClear();
  });

  it('mesma idempotencyKey nunca cria duas tasks', async () => {
    const { createConversationTask } = await import('../conversation-task.service');
    const first = await createConversationTask(baseInput());
    const second = await createConversationTask(baseInput({ title: 'Financiamento identificado (reprocessado)' }));

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(first.task.id).toBe(second.task.id);
    expect(Object.keys(tasks)).toHaveLength(1);
    expect(second.task.title).toBe('Financiamento identificado (reprocessado)');
  });

  it('reprocessar a mesma origem nunca ressuscita uma task já resolvida pelo usuário', async () => {
    const { createConversationTask, dismissConversationTask } = await import('../conversation-task.service');
    const { task } = await createConversationTask(baseInput());
    const dismissed = await dismissConversationTask({ id: task.id, userId: 'user-a' });
    expect(dismissed).toBe(true);
    expect(tasks[task.id]!.status).toBe('DISMISSED');

    const reprocessed = await createConversationTask(baseInput({ title: 'Financiamento identificado (retry do worker)' }));
    expect(reprocessed.created).toBe(false);
    expect(tasks[task.id]!.status).toBe('DISMISSED');
    expect(tasks[task.id]!.dismissedAt).not.toBeNull();
  });
});

describe('claimConversationTaskForResolution — idempotência de resolução (clique duplo)', () => {
  beforeEach(() => {
    tasks = {};
  });

  it('duas resoluções concorrentes da mesma task: só uma ganha a reserva', async () => {
    const { createConversationTask, claimConversationTaskForResolution } = await import('../conversation-task.service');
    const { task } = await createConversationTask(baseInput());

    const [claimA, claimB] = await Promise.all([
      claimConversationTaskForResolution({ id: task.id, userId: 'user-a' }),
      claimConversationTaskForResolution({ id: task.id, userId: 'user-a' }),
    ]);

    const claimed = [claimA, claimB].filter((result) => result !== null);
    expect(claimed).toHaveLength(1);
    expect(tasks[task.id]!.status).toBe('IN_PROGRESS');
  });

  it('completar depois de reivindicar é idempotente: segunda chamada não reexecuta', async () => {
    const { createConversationTask, claimConversationTaskForResolution, completeConversationTask } = await import('../conversation-task.service');
    const { task } = await createConversationTask(baseInput());
    const claimed = await claimConversationTaskForResolution({ id: task.id, userId: 'user-a' });
    expect(claimed).not.toBeNull();

    const firstComplete = await completeConversationTask({ id: task.id, userId: 'user-a' });
    const secondComplete = await completeConversationTask({ id: task.id, userId: 'user-a' });

    expect(firstComplete).toBe(true);
    expect(secondComplete).toBe(false);
    expect(tasks[task.id]!.status).toBe('COMPLETED');
    expect(tasks[task.id]!.completedAt).not.toBeNull();
  });

  it('task já COMPLETED nunca pode ser reivindicada de novo (mensagem repetida no chat)', async () => {
    const { createConversationTask, claimConversationTaskForResolution, completeConversationTask } = await import('../conversation-task.service');
    const { task } = await createConversationTask(baseInput());
    await claimConversationTaskForResolution({ id: task.id, userId: 'user-a' });
    await completeConversationTask({ id: task.id, userId: 'user-a' });

    const replay = await claimConversationTaskForResolution({ id: task.id, userId: 'user-a' });
    expect(replay).toBeNull();
  });

  it('falha recuperável volta pra WAITING_USER e pode ser reivindicada de novo', async () => {
    const { createConversationTask, claimConversationTaskForResolution, revertConversationTaskToWaitingUser } = await import('../conversation-task.service');
    const { task } = await createConversationTask(baseInput());
    await claimConversationTaskForResolution({ id: task.id, userId: 'user-a' });
    const reverted = await revertConversationTaskToWaitingUser({ id: task.id, userId: 'user-a' });
    expect(reverted).toBe(true);
    expect(tasks[task.id]!.status).toBe('WAITING_USER');

    const secondClaim = await claimConversationTaskForResolution({ id: task.id, userId: 'user-a' });
    expect(secondClaim).not.toBeNull();
  });

  it('usuário de outra conta nunca reivindica a task', async () => {
    const { createConversationTask, claimConversationTaskForResolution } = await import('../conversation-task.service');
    const { task } = await createConversationTask(baseInput());
    const claimed = await claimConversationTaskForResolution({ id: task.id, userId: 'user-b' });
    expect(claimed).toBeNull();
    expect(tasks[task.id]!.status).toBe('PENDING');
  });
});

describe('listPendingConversationTasks', () => {
  beforeEach(() => {
    tasks = {};
  });

  it('lista apenas PENDING/WAITING_USER do usuário, nunca COMPLETED/DISMISSED/de outro usuário', async () => {
    const { createConversationTask, claimConversationTaskForResolution, revertConversationTaskToWaitingUser, dismissConversationTask, listPendingConversationTasks } = await import('../conversation-task.service');
    const pending = await createConversationTask(baseInput({ idempotencyKey: 'key-pending' }));
    const waiting = await createConversationTask(baseInput({ idempotencyKey: 'key-waiting' }));
    await claimConversationTaskForResolution({ id: waiting.task.id, userId: 'user-a' });
    await revertConversationTaskToWaitingUser({ id: waiting.task.id, userId: 'user-a' });
    const dismissed = await createConversationTask(baseInput({ idempotencyKey: 'key-dismissed' }));
    await dismissConversationTask({ id: dismissed.task.id, userId: 'user-a' });
    await createConversationTask(baseInput({ idempotencyKey: 'key-other-user', userId: 'user-b' }));

    const list = await listPendingConversationTasks('user-a');
    const ids = list.map((task) => task.id).sort();
    expect(ids).toEqual([pending.task.id, waiting.task.id].sort());
  });
});
