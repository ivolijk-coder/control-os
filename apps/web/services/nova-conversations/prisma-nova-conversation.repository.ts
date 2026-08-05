import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { AppendMessageInput, ConversationScope, NovaConversationRepository } from './nova-conversation.interfaces';
import type { MessagePage, NovaConversation, NovaMessage } from './nova-conversation.types';

type ConversationRow = Awaited<ReturnType<typeof prisma.novaConversation.findFirst>>;
type MessageRow = Awaited<ReturnType<typeof prisma.novaMessage.findFirst>>;

function toConversation(row: NonNullable<ConversationRow>): NovaConversation {
  return {
    id: row.id,
    userId: row.userId,
    channel: row.channel,
    persona: row.persona,
    status: row.status,
    startedAt: row.startedAt,
    lastMessageAt: row.lastMessageAt,
    closedAt: row.closedAt,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toMessage(row: NonNullable<MessageRow>): NovaMessage {
  return {
    id: row.id,
    conversationId: row.conversationId,
    userId: row.userId,
    role: row.role,
    content: row.content,
    intent: row.intent,
    provider: row.provider,
    providerResponseId: row.providerResponseId,
    correlationId: row.correlationId,
    sequence: row.sequence.toString(),
    redacted: row.redacted,
    createdAt: row.createdAt,
  };
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export class PrismaNovaConversationRepository implements NovaConversationRepository {
  async getOrCreateActive(input: ConversationScope & { activeKey: string }): Promise<NovaConversation> {
    const existing = await prisma.novaConversation.findFirst({
      where: { userId: input.userId, activeKey: input.activeKey, status: 'ACTIVE', deletedAt: null },
    });
    if (existing) return toConversation(existing);

    try {
      const created = await prisma.novaConversation.create({
        data: {
          userId: input.userId,
          channel: input.channel,
          persona: input.persona,
          activeKey: input.activeKey,
        },
      });
      return toConversation(created);
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      const winner = await prisma.novaConversation.findFirst({
        where: { userId: input.userId, activeKey: input.activeKey, status: 'ACTIVE', deletedAt: null },
      });
      if (!winner) throw error;
      return toConversation(winner);
    }
  }

  async closeActive(scope: ConversationScope, closedAt: Date): Promise<NovaConversation | null> {
    return prisma.$transaction(async (tx) => {
      const current = await tx.novaConversation.findFirst({
        where: { userId: scope.userId, channel: scope.channel, persona: scope.persona, status: 'ACTIVE', deletedAt: null },
      });
      if (!current) return null;
      const closed = await tx.novaConversation.update({
        where: { id: current.id },
        data: { status: 'CLOSED', activeKey: null, closedAt },
      });
      return toConversation(closed);
    });
  }

  async markDeleted(input: { userId: string; conversationId: string; deletedAt: Date }): Promise<boolean> {
    const result = await prisma.novaConversation.updateMany({
      where: { id: input.conversationId, userId: input.userId, deletedAt: null },
      data: { deletedAt: input.deletedAt, activeKey: null, status: 'ARCHIVED' },
    });
    return result.count === 1;
  }

  async listConversations(input: { userId: string; limit: number }): Promise<NovaConversation[]> {
    const rows = await prisma.novaConversation.findMany({
      where: { userId: input.userId, deletedAt: null },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: input.limit,
    });
    return rows.map(toConversation);
  }

  async appendMessageAtomically(input: AppendMessageInput): Promise<{ message: NovaMessage; replayed: boolean }> {
    const replay = await prisma.novaMessage.findFirst({
      where: {
        conversationId: input.conversationId,
        userId: input.userId,
        correlationId: input.correlationId,
        role: input.role,
        conversation: { deletedAt: null },
      },
    });
    if (replay) return { message: toMessage(replay), replayed: true };

    try {
      const created = await prisma.$transaction(async (tx) => {
        const conversation = await tx.novaConversation.findFirst({
          where: { id: input.conversationId, userId: input.userId, status: 'ACTIVE', deletedAt: null },
          select: { id: true },
        });
        if (!conversation) throw new Error('NOVA_CONVERSATION_NOT_FOUND');

        const message = await tx.novaMessage.create({
          data: {
            conversationId: input.conversationId,
            userId: input.userId,
            role: input.role,
            content: input.content,
            intent: input.intent,
            provider: input.provider,
            providerResponseId: input.providerResponseId,
            correlationId: input.correlationId,
            redacted: input.redacted,
          },
        });
        await tx.novaConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: message.createdAt } });
        return message;
      });
      return { message: toMessage(created), replayed: false };
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      const winner = await prisma.novaMessage.findFirst({
        where: {
          conversationId: input.conversationId,
          userId: input.userId,
          correlationId: input.correlationId,
          role: input.role,
          conversation: { deletedAt: null },
        },
      });
      if (!winner) throw error;
      return { message: toMessage(winner), replayed: true };
    }
  }

  async listMessages(input: { userId: string; conversationId: string; limit: number; beforeSequence?: string }): Promise<MessagePage> {
    const conversation = await prisma.novaConversation.findFirst({
      where: { id: input.conversationId, userId: input.userId, deletedAt: null },
      select: { id: true },
    });
    if (!conversation) return { messages: [], nextCursor: null };

    const rows = await prisma.novaMessage.findMany({
      where: {
        conversationId: input.conversationId,
        userId: input.userId,
        ...(input.beforeSequence ? { sequence: { lt: BigInt(input.beforeSequence) } } : {}),
      },
      orderBy: { sequence: 'desc' },
      take: input.limit + 1,
    });
    const hasMore = rows.length > input.limit;
    const page = rows.slice(0, input.limit).reverse().map(toMessage);
    const firstMessage = page.at(0);
    return { messages: page, nextCursor: hasMore && firstMessage ? firstMessage.sequence : null };
  }
}
