import 'server-only';

import { randomUUID } from 'node:crypto';
import { Prisma, type NovaConversationPersona, type NovaPendingConfirmationStatus, type NovaTurnStatus } from '@prisma/client';
import type { ActionKind } from '@/services/control-hub';
import { prisma } from '@/lib/prisma';
import { sanitizeConversationContent } from '@/services/nova-conversations/conversation-content-sanitizer';
import { readNovaConfirmationPayload, validateNovaConfirmationPayload } from './nova-confirmation-payload.schemas';
import { NOVA_ORCHESTRATOR_PERSISTENCE } from './nova-orchestrator-persistence.config';
import { validateNovaReferenceSelection } from './nova-semantic-state.validation';
import type { NovaConversationSemanticState, NovaReferenceSelection } from './nova-orchestrator.types';

export interface NovaTurnRecord {
  id: string;
  conversationId: string;
  userId: string;
  clientTurnId: string;
  status: NovaTurnStatus;
  version: number;
  attemptCount: number;
  processingOwner: string | null;
  processingLeaseToken: string | null;
  processingLeaseUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NovaConfirmationRecord {
  id: string;
  turnId: string;
  conversationId: string;
  userId: string;
  actionKind: ActionKind;
  validatedPayload: Record<string, string | number | boolean>;
  status: NovaPendingConfirmationStatus;
  version: number;
  claimOwner: string | null;
  claimLeaseToken: string | null;
  claimLeaseUntil: Date | null;
  expiresAt: Date;
}

export type NovaTurnReplay =
  | { kind: 'COMPLETED'; turn: NovaTurnRecord; messages: NovaPersistedPublicMessage[] }
  | { kind: 'AWAITING_CONFIRMATION'; turn: NovaTurnRecord; confirmation: NovaConfirmationRecord }
  | { kind: 'PROCESSING'; turn: NovaTurnRecord }
  | { kind: 'RECOVERABLE'; turn: NovaTurnRecord }
  | { kind: 'TERMINAL'; turn: NovaTurnRecord };

export interface NovaPersistedPublicMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  intent: string | null;
  redacted: boolean;
  createdAt: Date;
}

export interface NovaAccessibleConversation {
  id: string;
  userId: string;
  persona: NovaConversationPersona;
}

const isUniqueConflict = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
const samePayload = (left: Record<string, string | number | boolean>, right: Record<string, string | number | boolean>) => JSON.stringify(left) === JSON.stringify(right);

function turnRecord(row: {
  id: string; conversationId: string; userId: string; clientTurnId: string; status: NovaTurnStatus; version: number;
  attemptCount: number; processingOwner: string | null; processingLeaseToken: string | null;
  processingLeaseUntil: Date | null; createdAt: Date; updatedAt: Date;
}): NovaTurnRecord {
  return { ...row };
}

function confirmationRecord(row: {
  id: string; turnId: string; conversationId: string; userId: string; actionKind: string; validatedPayload: unknown;
  status: NovaPendingConfirmationStatus; version: number; claimOwner: string | null; claimLeaseToken: string | null;
  claimLeaseUntil: Date | null; expiresAt: Date;
}): NovaConfirmationRecord {
  const actionKind = row.actionKind as ActionKind;
  return { ...row, actionKind, validatedPayload: readNovaConfirmationPayload(actionKind, row.validatedPayload) };
}

const accessibleConversation = (conversationId: string, userId: string) => ({ id: conversationId, userId, deletedAt: null });

export class PrismaNovaOrchestratorPersistence {
  async findAccessibleActiveWebConversation(input: { conversationId: string; userId: string }): Promise<NovaAccessibleConversation | null> {
    return prisma.novaConversation.findFirst({
      where: { id: input.conversationId, userId: input.userId, channel: 'WEB', status: 'ACTIVE', deletedAt: null },
      select: { id: true, userId: true, persona: true },
    });
  }

  async listRecentMessages(input: { conversationId: string; userId: string; limit?: number }): Promise<Array<{ role: 'USER' | 'ASSISTANT'; content: string; intent: string | null }>> {
    const messages = await prisma.novaMessage.findMany({
      where: { conversationId: input.conversationId, userId: input.userId, conversation: { channel: 'WEB', deletedAt: null } },
      orderBy: { sequence: 'desc' },
      take: Math.min(Math.max(input.limit ?? 20, 1), 100),
      select: { role: true, content: true, intent: true },
    });
    return messages.reverse();
  }

  async createOrReplayTurn(input: { conversationId: string; userId: string; clientTurnId: string }): Promise<{ turn: NovaTurnRecord; replayed: boolean } | null> {
    const conversation = await prisma.novaConversation.findFirst({ where: accessibleConversation(input.conversationId, input.userId), select: { id: true } });
    if (!conversation) return null;
    const existing = await prisma.novaTurn.findUnique({ where: { conversationId_clientTurnId: { conversationId: input.conversationId, clientTurnId: input.clientTurnId } } });
    if (existing) return existing.userId === input.userId ? { turn: turnRecord(existing), replayed: true } : null;
    try {
      const created = await prisma.novaTurn.create({ data: input });
      return { turn: turnRecord(created), replayed: false };
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      const winner = await prisma.novaTurn.findUnique({ where: { conversationId_clientTurnId: { conversationId: input.conversationId, clientTurnId: input.clientTurnId } } });
      return winner?.userId === input.userId ? { turn: turnRecord(winner), replayed: true } : null;
    }
  }

  async claimTurn(input: { turnId: string; conversationId: string; userId: string; expectedVersion: number; owner: string; now: Date; leaseMs?: number }): Promise<NovaTurnRecord | null> {
    const current = await prisma.novaTurn.findFirst({
      where: { id: input.turnId, conversationId: input.conversationId, userId: input.userId, conversation: { deletedAt: null } },
    });
    if (!current || current.version !== input.expectedVersion || current.attemptCount >= NOVA_ORCHESTRATOR_PERSISTENCE.maxTurnClaims) return null;
    const recoverable = (current.status === 'PROCESSING' || current.status === 'EXECUTING') && current.processingLeaseUntil !== null && current.processingLeaseUntil <= input.now;
    const received = current.status === 'RECEIVED' && (current.processingLeaseUntil === null || current.processingLeaseUntil <= input.now);
    if (!received && !recoverable) return null;

    const token = randomUUID();
    const result = await prisma.novaTurn.updateMany({
      where: {
        id: current.id,
        conversationId: input.conversationId,
        userId: input.userId,
        version: input.expectedVersion,
        status: current.status,
        ...(current.processingLeaseUntil === null ? { processingLeaseUntil: null } : { processingLeaseUntil: { lte: input.now } }),
      },
      data: {
        status: current.status === 'RECEIVED' ? 'PROCESSING' : current.status,
        processingOwner: input.owner,
        processingLeaseToken: token,
        processingLeaseUntil: new Date(input.now.getTime() + (input.leaseMs ?? NOVA_ORCHESTRATOR_PERSISTENCE.turnLeaseMs)),
        attemptCount: { increment: 1 },
        version: { increment: 1 },
        startedAt: current.startedAt ?? input.now,
      },
    });
    if (result.count !== 1) return null;
    const claimed = await prisma.novaTurn.findUnique({ where: { id: current.id } });
    return claimed ? turnRecord(claimed) : null;
  }

  async heartbeatTurn(input: { turnId: string; userId: string; expectedVersion: number; owner: string; leaseToken: string; now: Date }): Promise<NovaTurnRecord | null> {
    const result = await prisma.novaTurn.updateMany({
      where: { id: input.turnId, userId: input.userId, version: input.expectedVersion, status: { in: ['PROCESSING', 'EXECUTING'] }, processingOwner: input.owner, processingLeaseToken: input.leaseToken, processingLeaseUntil: { gt: input.now } },
      data: { processingLeaseUntil: new Date(input.now.getTime() + NOVA_ORCHESTRATOR_PERSISTENCE.turnLeaseMs), version: { increment: 1 } },
    });
    if (result.count !== 1) return null;
    const row = await prisma.novaTurn.findUnique({ where: { id: input.turnId } });
    return row ? turnRecord(row) : null;
  }

  async failTurn(input: { turnId: string; conversationId: string; userId: string; expectedVersion: number; owner: string; leaseToken: string; now: Date; errorCode: string }): Promise<boolean> {
    const result = await prisma.novaTurn.updateMany({
      where: {
        id: input.turnId,
        conversationId: input.conversationId,
        userId: input.userId,
        version: input.expectedVersion,
        status: 'PROCESSING',
        processingOwner: input.owner,
        processingLeaseToken: input.leaseToken,
        conversation: { channel: 'WEB', status: 'ACTIVE', deletedAt: null },
      },
      data: {
        status: 'FAILED',
        failedAt: input.now,
        lastErrorCode: input.errorCode,
        processingOwner: null,
        processingLeaseToken: null,
        processingLeaseUntil: null,
        version: { increment: 1 },
      },
    });
    return result.count === 1;
  }

  async completeTurnWithMessages(input: { turnId: string; conversationId: string; userId: string; expectedVersion: number; owner: string; leaseToken: string; now: Date; user: { content: string; intent?: string | null }; assistant: { content: string; intent?: string | null; provider?: string | null; providerResponseId?: string | null } }): Promise<NovaTurnRecord | null> {
    const user = sanitizeConversationContent(input.user.content);
    const assistant = sanitizeConversationContent(input.assistant.content);
    return prisma.$transaction(async (tx) => {
      const ownership = await tx.novaTurn.updateMany({
        where: { id: input.turnId, conversationId: input.conversationId, userId: input.userId, version: input.expectedVersion, status: { in: ['PROCESSING', 'EXECUTING'] }, processingOwner: input.owner, processingLeaseToken: input.leaseToken, processingLeaseUntil: { gt: input.now }, conversation: { deletedAt: null } },
        data: { status: 'COMPLETED', completedAt: input.now, provider: input.assistant.provider, providerResponseId: input.assistant.providerResponseId, processingOwner: null, processingLeaseToken: null, processingLeaseUntil: null, version: { increment: 1 } },
      });
      if (ownership.count !== 1) return null;
      await tx.novaMessage.createMany({
        data: [
          { conversationId: input.conversationId, userId: input.userId, role: 'USER', content: user.content, intent: input.user.intent, correlationId: input.turnId, redacted: user.redacted },
          { conversationId: input.conversationId, userId: input.userId, role: 'ASSISTANT', content: assistant.content, intent: input.assistant.intent, provider: input.assistant.provider, providerResponseId: input.assistant.providerResponseId, correlationId: input.turnId, redacted: assistant.redacted },
        ],
      });
      const finalMessage = await tx.novaMessage.findFirst({ where: { conversationId: input.conversationId, correlationId: input.turnId, role: 'ASSISTANT' }, select: { createdAt: true } });
      await tx.novaConversation.update({ where: { id: input.conversationId }, data: { lastMessageAt: finalMessage?.createdAt ?? input.now } });
      const completed = await tx.novaTurn.findUnique({ where: { id: input.turnId } });
      return completed ? turnRecord(completed) : null;
    });
  }

  async replayTurn(input: { turnId: string; conversationId: string; userId: string; now: Date }): Promise<NovaTurnReplay | null> {
    const turn = await prisma.novaTurn.findFirst({ where: { id: input.turnId, conversationId: input.conversationId, userId: input.userId, conversation: { deletedAt: null } } });
    if (!turn) return null;
    const record = turnRecord(turn);
    if (turn.status === 'COMPLETED') {
      const messages = await prisma.novaMessage.findMany({ where: { conversationId: input.conversationId, userId: input.userId, correlationId: input.turnId }, orderBy: { sequence: 'asc' }, select: { id: true, role: true, content: true, intent: true, redacted: true, createdAt: true } });
      return { kind: 'COMPLETED', turn: record, messages };
    }
    if (turn.status === 'AWAITING_CONFIRMATION') {
      const confirmation = await this.findConfirmation({ turnId: turn.id, conversationId: turn.conversationId, userId: turn.userId, now: input.now });
      return confirmation ? { kind: 'AWAITING_CONFIRMATION', turn: record, confirmation } : null;
    }
    if ((turn.status === 'PROCESSING' || turn.status === 'EXECUTING') && turn.processingLeaseUntil && turn.processingLeaseUntil <= input.now) return { kind: 'RECOVERABLE', turn: record };
    if (turn.status === 'PROCESSING' || turn.status === 'EXECUTING' || turn.status === 'RECEIVED') return { kind: 'PROCESSING', turn: record };
    return { kind: 'TERMINAL', turn: record };
  }

  async createConfirmation(input: { turnId: string; conversationId: string; userId: string; expectedTurnVersion: number; actionKind: ActionKind; payload: unknown; now: Date }): Promise<{ confirmation: NovaConfirmationRecord; replayed: boolean } | null> {
    const payload = validateNovaConfirmationPayload(input.actionKind, input.payload);
    const replay = async () => {
      const existing = await this.findConfirmation({ turnId: input.turnId, conversationId: input.conversationId, userId: input.userId, now: input.now });
      return existing && existing.actionKind === input.actionKind && samePayload(existing.validatedPayload, payload)
        ? { confirmation: existing, replayed: true }
        : null;
    };
    const existing = await replay();
    if (existing) return existing;
    try {
      const created = await prisma.$transaction(async (tx) => {
        const moved = await tx.novaTurn.updateMany({ where: { id: input.turnId, conversationId: input.conversationId, userId: input.userId, version: input.expectedTurnVersion, status: 'PROCESSING', conversation: { deletedAt: null } }, data: { status: 'AWAITING_CONFIRMATION', processingOwner: null, processingLeaseToken: null, processingLeaseUntil: null, version: { increment: 1 } } });
        if (moved.count !== 1) return null;
        const row = await tx.novaPendingConfirmation.create({ data: { turnId: input.turnId, conversationId: input.conversationId, userId: input.userId, actionKind: input.actionKind, validatedPayload: payload, expiresAt: new Date(input.now.getTime() + NOVA_ORCHESTRATOR_PERSISTENCE.confirmationTtlMs) } });
        return { confirmation: confirmationRecord(row), replayed: false };
      });
      return created ?? replay();
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      return replay();
    }
  }

  async findConfirmation(input: { turnId: string; conversationId: string; userId: string; now: Date }): Promise<NovaConfirmationRecord | null> {
    await prisma.novaPendingConfirmation.updateMany({ where: { turnId: input.turnId, conversationId: input.conversationId, userId: input.userId, status: { in: ['PENDING', 'CLAIMED'] }, expiresAt: { lte: input.now }, turn: { conversation: { deletedAt: null } } }, data: { status: 'EXPIRED', expiredAt: input.now, claimOwner: null, claimLeaseToken: null, claimLeaseUntil: null, version: { increment: 1 } } });
    const row = await prisma.novaPendingConfirmation.findFirst({ where: { turnId: input.turnId, conversationId: input.conversationId, userId: input.userId, turn: { conversation: { deletedAt: null } } } });
    return row ? confirmationRecord(row) : null;
  }

  async claimConfirmation(input: { confirmationId: string; conversationId: string; userId: string; expectedVersion: number; owner: string; now: Date }): Promise<NovaConfirmationRecord | null> {
    const current = await prisma.novaPendingConfirmation.findFirst({ where: { id: input.confirmationId, conversationId: input.conversationId, userId: input.userId, turn: { conversation: { deletedAt: null } } } });
    if (!current || current.version !== input.expectedVersion || current.expiresAt <= input.now) return null;
    const available = current.status === 'PENDING' || (current.status === 'CLAIMED' && current.claimLeaseUntil !== null && current.claimLeaseUntil <= input.now);
    if (!available) return null;
    const token = randomUUID();
    const claimed = await prisma.novaPendingConfirmation.updateMany({ where: { id: current.id, version: input.expectedVersion, status: current.status, ...(current.status === 'CLAIMED' ? { claimLeaseUntil: { lte: input.now } } : {}) }, data: { status: 'CLAIMED', claimOwner: input.owner, claimLeaseToken: token, claimLeaseUntil: new Date(input.now.getTime() + NOVA_ORCHESTRATOR_PERSISTENCE.confirmationLeaseMs), attemptCount: { increment: 1 }, version: { increment: 1 } } });
    if (claimed.count !== 1) return null;
    const row = await prisma.novaPendingConfirmation.findUnique({ where: { id: current.id } });
    return row ? confirmationRecord(row) : null;
  }

  /** Infraestrutura somente: não chama Action Registry nem qualquer serviço financeiro. */
  async finalizeConfirmation(input: { confirmationId: string; userId: string; expectedVersion: number; owner: string; leaseToken: string; now: Date }): Promise<NovaConfirmationRecord | null> {
    const updated = await prisma.novaPendingConfirmation.updateMany({ where: { id: input.confirmationId, userId: input.userId, version: input.expectedVersion, status: 'CLAIMED', claimOwner: input.owner, claimLeaseToken: input.leaseToken, claimLeaseUntil: { gt: input.now }, expiresAt: { gt: input.now }, turn: { conversation: { deletedAt: null } } }, data: { status: 'CONFIRMED', confirmedAt: input.now, claimOwner: null, claimLeaseToken: null, claimLeaseUntil: null, version: { increment: 1 } } });
    if (updated.count !== 1) return null;
    const row = await prisma.novaPendingConfirmation.findUnique({ where: { id: input.confirmationId } });
    return row ? confirmationRecord(row) : null;
  }

  async cancelConfirmation(input: { confirmationId: string; conversationId: string; userId: string; now: Date }): Promise<NovaConfirmationRecord | null> {
    const current = await prisma.novaPendingConfirmation.findFirst({ where: { id: input.confirmationId, conversationId: input.conversationId, userId: input.userId, turn: { conversation: { deletedAt: null } } } });
    if (!current) return null;
    if (current.status === 'CANCELLED') return confirmationRecord(current);
    if (['CONFIRMED', 'EXPIRED', 'FAILED'].includes(current.status)) return confirmationRecord(current);
    await prisma.novaPendingConfirmation.updateMany({ where: { id: current.id, version: current.version, status: current.status }, data: { status: 'CANCELLED', cancelledAt: input.now, claimOwner: null, claimLeaseToken: null, claimLeaseUntil: null, version: { increment: 1 } } });
    const row = await prisma.novaPendingConfirmation.findUnique({ where: { id: current.id } });
    return row ? confirmationRecord(row) : null;
  }

  async getSemanticState(input: { conversationId: string; userId: string; now: Date }): Promise<NovaConversationSemanticState | null> {
    const row = await prisma.novaConversationState.findFirst({ where: { conversationId: input.conversationId, userId: input.userId, expiresAt: { gt: input.now }, conversation: { deletedAt: null } } });
    if (!row) return null;
    return { conversationId: row.conversationId, userId: row.userId, intentFamily: row.intentFamily, focusCategory: row.focusCategory, focusType: row.focusType, focusReference: validateNovaReferenceSelection(row.focusReference), sourceTurnId: row.sourceTurnId, version: row.version, expiresAt: row.expiresAt, updatedAt: row.updatedAt };
  }

  async compareAndSetSemanticState(input: { conversationId: string; userId: string; intentFamily: string; focusCategory: string | null; focusType: string | null; focusReference: NovaReferenceSelection | null; sourceTurnId: string; expectedVersion: number | null; now: Date }): Promise<boolean> {
    const focusReference = validateNovaReferenceSelection(input.focusReference) as Prisma.InputJsonValue | null;
    if (input.expectedVersion === null) {
      try {
        await prisma.novaConversationState.create({ data: { conversationId: input.conversationId, userId: input.userId, intentFamily: input.intentFamily, focusCategory: input.focusCategory, focusType: input.focusType, focusReference: focusReference ?? Prisma.JsonNull, sourceTurnId: input.sourceTurnId, expiresAt: new Date(input.now.getTime() + NOVA_ORCHESTRATOR_PERSISTENCE.semanticStateTtlMs) } });
        return true;
      } catch (error) {
        if (isUniqueConflict(error)) return false;
        throw error;
      }
    }
    const updated = await prisma.novaConversationState.updateMany({ where: { conversationId: input.conversationId, userId: input.userId, version: input.expectedVersion, conversation: { deletedAt: null } }, data: { intentFamily: input.intentFamily, focusCategory: input.focusCategory, focusType: input.focusType, focusReference: focusReference ?? Prisma.JsonNull, sourceTurnId: input.sourceTurnId, expiresAt: new Date(input.now.getTime() + NOVA_ORCHESTRATOR_PERSISTENCE.semanticStateTtlMs), version: { increment: 1 } } });
    return updated.count === 1;
  }

  async completeReadOnlyTurn(input: {
    turnId: string;
    conversationId: string;
    userId: string;
    expectedVersion: number;
    owner: string;
    leaseToken: string;
    now: Date;
    intentFamily: string;
    focusCategory: string | null;
    focusType: string | null;
    focusReference: NovaReferenceSelection | null;
    userContent: string;
    assistantContent: string;
  }): Promise<{ turn: NovaTurnRecord; messages: NovaPersistedPublicMessage[] } | null> {
    const user = sanitizeConversationContent(input.userContent);
    const assistant = sanitizeConversationContent(input.assistantContent);
    const focusReference = validateNovaReferenceSelection(input.focusReference) as Prisma.InputJsonValue | null;
    return prisma.$transaction(async (tx) => {
      const owned = await tx.novaTurn.updateMany({
        where: {
          id: input.turnId,
          conversationId: input.conversationId,
          userId: input.userId,
          version: input.expectedVersion,
          status: 'PROCESSING',
          processingOwner: input.owner,
          processingLeaseToken: input.leaseToken,
          processingLeaseUntil: { gt: input.now },
          conversation: { channel: 'WEB', status: 'ACTIVE', deletedAt: null },
        },
        data: {
          status: 'COMPLETED',
          intentFamily: input.intentFamily,
          focusCategory: input.focusCategory,
          completedAt: input.now,
          processingOwner: null,
          processingLeaseToken: null,
          processingLeaseUntil: null,
          version: { increment: 1 },
        },
      });
      if (owned.count !== 1) return null;

      await tx.novaMessage.createMany({
        data: [
          { conversationId: input.conversationId, userId: input.userId, role: 'USER', content: user.content, intent: input.intentFamily, correlationId: input.turnId, redacted: user.redacted },
          { conversationId: input.conversationId, userId: input.userId, role: 'ASSISTANT', content: assistant.content, intent: input.intentFamily, correlationId: input.turnId, redacted: assistant.redacted },
        ],
      });

      // Serializa apenas a finalização desta conversa; nenhuma chamada externa ocorre na transação.
      await tx.$queryRaw(Prisma.sql`SELECT id FROM nova_conversations WHERE id = ${input.conversationId}::uuid FOR UPDATE`);
      const currentState = await tx.novaConversationState.findUnique({ where: { conversationId: input.conversationId } });
      const currentSource = currentState
        ? await tx.novaTurn.findUnique({ where: { id: currentState.sourceTurnId }, select: { createdAt: true, id: true } })
        : null;
      const thisTurn = await tx.novaTurn.findUniqueOrThrow({ where: { id: input.turnId }, select: { createdAt: true, id: true } });
      const shouldAdvanceState = !currentSource
        || currentSource.createdAt < thisTurn.createdAt
        || (currentSource.createdAt.getTime() === thisTurn.createdAt.getTime() && currentSource.id <= thisTurn.id);
      if (shouldAdvanceState) {
        await tx.novaConversationState.upsert({
          where: { conversationId: input.conversationId },
          create: {
            conversationId: input.conversationId,
            userId: input.userId,
            intentFamily: input.intentFamily,
            focusCategory: input.focusCategory,
            focusType: input.focusType,
            focusReference: focusReference ?? Prisma.JsonNull,
            sourceTurnId: input.turnId,
            expiresAt: new Date(input.now.getTime() + NOVA_ORCHESTRATOR_PERSISTENCE.semanticStateTtlMs),
          },
          update: {
            intentFamily: input.intentFamily,
            focusCategory: input.focusCategory,
            focusType: input.focusType,
            focusReference: focusReference ?? Prisma.JsonNull,
            sourceTurnId: input.turnId,
            expiresAt: new Date(input.now.getTime() + NOVA_ORCHESTRATOR_PERSISTENCE.semanticStateTtlMs),
            version: { increment: 1 },
          },
        });
      }

      const messages = await tx.novaMessage.findMany({
        where: { conversationId: input.conversationId, correlationId: input.turnId },
        orderBy: { sequence: 'asc' },
        select: { id: true, role: true, content: true, intent: true, redacted: true, createdAt: true },
      });
      await tx.novaConversation.update({ where: { id: input.conversationId }, data: { lastMessageAt: messages.at(-1)?.createdAt ?? input.now } });
      const completed = await tx.novaTurn.findUniqueOrThrow({ where: { id: input.turnId } });
      return { turn: turnRecord(completed), messages };
    });
  }
}

export const novaOrchestratorPersistence = new PrismaNovaOrchestratorPersistence();
