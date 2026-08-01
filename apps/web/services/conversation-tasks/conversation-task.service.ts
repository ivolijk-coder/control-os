import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type {
  ConversationTask,
  ConversationTaskAction,
  ConversationTaskPriority,
  ConversationTaskType,
} from './conversation-task.types';

/**
 * `ConversationTaskService` — cria, lista pendentes e resolve/descarta
 * `ConversationTask`s. Camada genérica: não conhece `DocumentImportProposal`
 * nem nenhum conceito do módulo Documentos — quem sabe disso é o produtor
 * (Fase C, dentro de `contract-analysis.ts`) e o handler que interpreta
 * `payload`/`actions` (Fase E).
 *
 * Idempotência ponta a ponta (clique duplo, refresh, mensagem repetida
 * nunca executam a ação duas vezes):
 * - Criação: `idempotencyKey` é `@unique`; `createConversationTask` faz o
 *   mesmo padrão de `findFirst` + `upsert` que `contract-analysis.ts` já
 *   usa para `DocumentImportProposal.idempotencyKey` — reprocessar o
 *   mesmo evento de origem atualiza o conteúdo (título/mensagem/ações),
 *   nunca cria uma segunda task nem regride `status`/`completedAt`/
 *   `dismissedAt` de uma task que o usuário já resolveu ou descartou.
 * - Resolução: `claimConversationTaskForResolution` só avança quando o
 *   `status` atual é `PENDING`/`WAITING_USER` (o mesmo "claim atômico" via
 *   `updateMany` que `confirm/route.ts` já usa para `DocumentImportProposal`)
 *   — a segunda tentativa concorrente nunca vê `count > 0` e não executa
 *   a ação de novo.
 */

type TransactionClient = typeof prisma;

type ConversationTaskRow = {
  id: string;
  userId: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  message: string;
  payload: unknown;
  actions: unknown;
  sourceType: string;
  sourceId: string;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  dismissedAt: Date | null;
};

function toConversationTask(row: ConversationTaskRow): ConversationTask {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as ConversationTaskType,
    status: row.status as ConversationTask['status'],
    priority: row.priority as ConversationTaskPriority,
    title: row.title,
    message: row.message,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    actions: (Array.isArray(row.actions) ? row.actions : []) as ConversationTaskAction[],
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
    dismissedAt: row.dismissedAt,
  };
}

export type CreateConversationTaskInput = {
  userId: string;
  type: ConversationTaskType;
  priority: ConversationTaskPriority;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  actions: ConversationTaskAction[];
  sourceType: string;
  sourceId: string;
  idempotencyKey: string;
};

/**
 * Idempotente por `idempotencyKey`. Pensada para ser chamada dentro da
 * MESMA transação que grava o registro de origem (ex.: `contract-analysis.ts`
 * gravando `DocumentImportProposal` — Fase C) via o parâmetro `tx`; os dois
 * nascem juntos ou nenhum nasce. Em cima de uma task já existente, atualiza
 * só o conteúdo apresentável (título/mensagem/payload/ações/prioridade) —
 * nunca `status`, `completedAt` ou `dismissedAt`, para não ressuscitar uma
 * task que o usuário já resolveu ou descartou.
 */
export async function createConversationTask(
  input: CreateConversationTaskInput,
  tx?: TransactionClient
): Promise<{ task: ConversationTask; created: boolean }> {
  const client = tx ?? prisma;
  const existing = await client.conversationTask.findFirst({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true } });
  const row = await client.conversationTask.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      userId: input.userId,
      type: input.type,
      priority: input.priority,
      title: input.title,
      message: input.message,
      payload: input.payload as unknown as Prisma.InputJsonValue,
      actions: input.actions as unknown as Prisma.InputJsonValue,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      idempotencyKey: input.idempotencyKey,
    },
    update: {
      title: input.title,
      message: input.message,
      payload: input.payload as unknown as Prisma.InputJsonValue,
      actions: input.actions as unknown as Prisma.InputJsonValue,
      priority: input.priority,
    },
  });
  return { task: toConversationTask(row), created: !existing };
}

/** Tasks que a NOVA ainda precisa apresentar ou que aguardam resposta do usuário. */
export async function listPendingConversationTasks(userId: string): Promise<ConversationTask[]> {
  const rows = await prisma.conversationTask.findMany({
    where: { userId, status: { in: ['PENDING', 'WAITING_USER'] } },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });
  return rows.map(toConversationTask);
}

/**
 * Reserva atômica antes de executar a ação escolhida pelo usuário — o
 * mesmo padrão de `updateMany` com guarda de status que
 * `DocumentProposalConfirmationService` já usa. Devolve a task (para o
 * handler ler `payload`/`sourceId`) só para quem de fato ganhou a
 * reserva; qualquer chamada concorrente (clique duplo, duas abas,
 * reenvio da mesma mensagem) recebe `null` e não deve executar nada.
 */
export async function claimConversationTaskForResolution(input: { id: string; userId: string }): Promise<ConversationTask | null> {
  const claim = await prisma.conversationTask.updateMany({
    where: { id: input.id, userId: input.userId, status: { in: ['PENDING', 'WAITING_USER'] } },
    data: { status: 'IN_PROGRESS' },
  });
  if (!claim.count) return null;
  const row = await prisma.conversationTask.findFirst({ where: { id: input.id, userId: input.userId } });
  return row ? toConversationTask(row) : null;
}

/** Handler concluiu com sucesso (ex.: `confirmDocumentProposal` executou). */
export async function completeConversationTask(input: { id: string; userId: string }): Promise<boolean> {
  const result = await prisma.conversationTask.updateMany({
    where: { id: input.id, userId: input.userId, status: 'IN_PROGRESS' },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
  return result.count > 0;
}

/**
 * Handler falhou de um jeito recuperável (ex.: dado que o usuário
 * forneceu não validou) — volta pra `WAITING_USER` para a NOVA pedir de
 * novo, sem perder a task nem deixá-la presa em `IN_PROGRESS` para
 * sempre.
 */
export async function revertConversationTaskToWaitingUser(input: { id: string; userId: string }): Promise<boolean> {
  const result = await prisma.conversationTask.updateMany({
    where: { id: input.id, userId: input.userId, status: 'IN_PROGRESS' },
    data: { status: 'WAITING_USER' },
  });
  return result.count > 0;
}

/** Falha terminal, não recuperável por nova tentativa do usuário. */
export async function failConversationTask(input: { id: string; userId: string }): Promise<boolean> {
  const result = await prisma.conversationTask.updateMany({
    where: { id: input.id, userId: input.userId, status: 'IN_PROGRESS' },
    data: { status: 'FAILED' },
  });
  return result.count > 0;
}

/** Usuário escolheu "depois"/dispensou — nunca a partir de `IN_PROGRESS` ou de um estado terminal. */
export async function dismissConversationTask(input: { id: string; userId: string }): Promise<boolean> {
  const result = await prisma.conversationTask.updateMany({
    where: { id: input.id, userId: input.userId, status: { in: ['PENDING', 'WAITING_USER'] } },
    data: { status: 'DISMISSED', dismissedAt: new Date() },
  });
  return result.count > 0;
}
