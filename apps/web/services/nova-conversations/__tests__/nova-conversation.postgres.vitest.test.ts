import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const enabled = process.env.RUN_NOVA_CONVERSATION_POSTGRES_TESTS === '1' && Boolean(process.env.TEST_DATABASE_URL);

describe.runIf(enabled)('NovaConversation — PostgreSQL real', () => {
  const userId = '91919191-9191-4919-8919-919191919191';
  const otherUserId = '92929292-9292-4929-8929-929292929292';

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const { prisma } = await import('@/lib/prisma');
    await prisma.appUser.upsert({
      where: { id: userId },
      create: { id: userId, name: 'Usuario de teste PR9.1', email: 'pr9.1-postgres@example.test', passwordHash: 'not-a-real-password' },
      update: {},
    });
    await prisma.appUser.upsert({
      where: { id: otherUserId },
      create: { id: otherUserId, name: 'Outro usuário PR9.2', email: 'pr9.2-other@example.test', passwordHash: 'not-a-real-password' },
      update: {},
    });
  });

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma');
    await prisma.appUser.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
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

  it('fecha por ID com ownership e pagina datas iguais de forma estável', async () => {
    const { PrismaNovaConversationRepository } = await import('../prisma-nova-conversation.repository');
    const { NovaConversationServiceImpl } = await import('../nova-conversation.service');
    const { prisma } = await import('@/lib/prisma');
    const service = new NovaConversationServiceImpl(new PrismaNovaConversationRepository());

    const legendary = await service.getOrCreateActive({ userId, channel: 'WEB', persona: 'LEGENDARY' });
    const novaActive = await service.getOrCreateActive({ userId, channel: 'WEB', persona: 'NOVA' });
    await expect(service.closeConversation({ userId: otherUserId, conversationId: legendary.id, channel: 'WEB' })).resolves.toBeNull();
    const closed = await service.closeConversation({ userId, conversationId: legendary.id, channel: 'WEB' });
    const replay = await service.closeConversation({ userId, conversationId: legendary.id, channel: 'WEB' });
    expect(closed?.id).toBe(legendary.id);
    expect(replay?.id).toBe(legendary.id);
    expect((await prisma.novaConversation.findUnique({ where: { id: novaActive.id } }))?.status).toBe('ACTIVE');
    const nextLegendary = await service.getOrCreateActive({ userId, channel: 'WEB', persona: 'LEGENDARY' });
    expect(nextLegendary.id).not.toBe(legendary.id);

    const novaIds: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const current = await service.getOrCreateActive({ userId, channel: 'APP', persona: 'NOVA' });
      novaIds.push(current.id);
      await service.closeConversation({ userId, conversationId: current.id, channel: 'APP' });
    }
    const sharedDate = new Date('2026-08-07T13:00:00.000Z');
    await prisma.novaConversation.updateMany({ where: { id: { in: novaIds } }, data: { lastMessageAt: sharedDate } });
    const expected = [...novaIds].sort((a, b) => b.localeCompare(a));
    const first = await service.listConversations({ userId, channel: 'APP', persona: 'NOVA', limit: 2 });
    const second = await service.listConversations({
      userId, channel: 'APP', persona: 'NOVA', limit: 2, cursor: first.nextCursor ?? undefined,
    });
    expect([...first.items, ...second.items].map((item) => item.id)).toEqual(expected);
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(3);

    await service.appendMessage({
      userId, conversationId: novaActive.id, role: 'USER', content: 'isolada', correlationId: 'ownership-message',
    });
    await expect(service.listMessages({ userId: otherUserId, conversationId: novaActive.id, channel: 'WEB' })).resolves.toBeNull();
  });
});
