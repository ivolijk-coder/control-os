import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const enabled = process.env.RUN_NOVA_CONVERSATION_POSTGRES_TESTS === '1' && Boolean(process.env.TEST_DATABASE_URL);

describe.runIf(enabled)('NovaConversation — PostgreSQL real', () => {
  const userId = '91919191-9191-4919-8919-919191919191';

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const { prisma } = await import('@/lib/prisma');
    await prisma.appUser.upsert({
      where: { id: userId },
      create: { id: userId, name: 'Usuario de teste PR9.1', email: 'pr9.1-postgres@example.test', passwordHash: 'not-a-real-password' },
      update: {},
    });
  });

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma');
    await prisma.appUser.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('garante conversa ativa unica e correlationId idempotente sob concorrencia', async () => {
    const { PrismaNovaConversationRepository } = await import('../prisma-nova-conversation.repository');
    const { NovaConversationServiceImpl } = await import('../nova-conversation.service');
    const { prisma } = await import('@/lib/prisma');
    const service = new NovaConversationServiceImpl(new PrismaNovaConversationRepository());
    const scope = { userId, channel: 'WEB' as const, persona: 'NOVA' as const };

    const conversations = await Promise.all(Array.from({ length: 8 }, () => service.getOrCreateActive(scope)));
    expect(new Set(conversations.map((item) => item.id)).size).toBe(1);
    expect(await prisma.novaConversation.count({ where: { userId, channel: 'WEB', persona: 'NOVA', status: 'ACTIVE' } })).toBe(1);

    const conversationId = conversations[0]!.id;
    const input = { userId, conversationId, role: 'USER' as const, content: 'mensagem concorrente', correlationId: 'postgres-turn-1' };
    const messages = await Promise.all(Array.from({ length: 8 }, () => service.appendMessage(input)));
    expect(new Set(messages.map((item) => item.message.id)).size).toBe(1);
    expect(await prisma.novaMessage.count({ where: { conversationId, correlationId: 'postgres-turn-1', role: 'USER' } })).toBe(1);
  });
});
