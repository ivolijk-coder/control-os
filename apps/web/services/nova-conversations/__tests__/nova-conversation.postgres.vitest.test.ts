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

  it('persiste o par atomicamente, protege replay concorrente, ownership e rollback real', async () => {
    const { PrismaNovaConversationRepository } = await import('../prisma-nova-conversation.repository');
    const { NovaConversationServiceImpl } = await import('../nova-conversation.service');
    const { prisma } = await import('@/lib/prisma');
    const service = new NovaConversationServiceImpl(new PrismaNovaConversationRepository());
    const conversation = await service.getOrCreateActive({ userId, channel: 'API', persona: 'NOVA' });
    const input = {
      userId, conversationId: conversation.id, channel: 'API' as const, correlationId: 'postgres-atomic-turn-1',
      user: { content: 'Pergunta concorrente' }, assistant: { content: 'Resposta concorrente' },
    };

    const results = await Promise.all(Array.from({ length: 8 }, () => service.persistTurn(input)));
    const pairs = results.map((result) => `${result?.turn.user.id}:${result?.turn.assistant.id}`);
    expect(new Set(pairs).size).toBe(1);
    expect(await prisma.novaMessage.count({ where: { conversationId: conversation.id, correlationId: input.correlationId } })).toBe(2);
    const ordered = await prisma.novaMessage.findMany({
      where: { conversationId: conversation.id, correlationId: input.correlationId }, orderBy: { sequence: 'asc' },
    });
    expect(ordered.map((message) => message.role)).toEqual(['USER', 'ASSISTANT']);
    const persistedConversation = await prisma.novaConversation.findUniqueOrThrow({ where: { id: conversation.id } });
    expect(persistedConversation.lastMessageAt).toEqual(ordered[1]?.createdAt);

    await expect(service.persistTurn({ ...input, userId: otherUserId, correlationId: 'postgres-foreign-turn' })).resolves.toBeNull();

    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION reject_pr93a_assistant() RETURNS trigger AS $$
      BEGIN
        IF NEW.role = 'ASSISTANT' AND NEW.correlation_id = 'postgres-rollback-turn' THEN
          RAISE EXCEPTION 'synthetic assistant failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER reject_pr93a_assistant_trigger
      BEFORE INSERT ON nova_messages
      FOR EACH ROW EXECUTE FUNCTION reject_pr93a_assistant()
    `);
    try {
      await expect(service.persistTurn({
        ...input,
        correlationId: 'postgres-rollback-turn',
        user: { content: 'USER deve sofrer rollback' },
        assistant: { content: 'ASSISTANT falha' },
      })).rejects.toThrow();
      expect(await prisma.novaMessage.count({
        where: { conversationId: conversation.id, correlationId: 'postgres-rollback-turn' },
      })).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS reject_pr93a_assistant_trigger ON nova_messages');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS reject_pr93a_assistant()');
    }
  });
});
