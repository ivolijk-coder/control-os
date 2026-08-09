import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const enabled = process.env.RUN_NOVA_ORCHESTRATOR_POSTGRES_TESTS === '1' && Boolean(process.env.TEST_DATABASE_URL);

describe.runIf(enabled)('PR10.3 read-only orchestrator — PostgreSQL real', () => {
  const userId = 'b1010101-1010-4010-8010-101010101010';
  const otherUserId = 'b2020202-2020-4020-8020-202020202020';
  let conversationId = '';

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const { prisma } = await import('@/lib/prisma');
    await prisma.appUser.createMany({
      data: [
        { id: userId, name: 'PR10.3', email: 'pr10.3@example.test', passwordHash: 'test-only' },
        { id: otherUserId, name: 'Outro PR10.3', email: 'pr10.3-other@example.test', passwordHash: 'test-only' },
      ], skipDuplicates: true,
    });
    conversationId = (await prisma.novaConversation.create({
      data: { userId, channel: 'WEB', persona: 'NOVA', status: 'ACTIVE', activeKey: `pr10.3:${userId}` },
    })).id;
  });

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma');
    await prisma.appUser.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await prisma.$disconnect();
  });

  it('protege ownership e mantém um único turno em replay concorrente', async () => {
    const { novaOrchestratorPersistence: repository } = await import('../nova-orchestrator-persistence.repository');
    const { prisma } = await import('@/lib/prisma');
    await expect(repository.findAccessibleActiveWebConversation({ conversationId, userId: otherUserId })).resolves.toBeNull();
    const attempts = await Promise.all(Array.from({ length: 8 }, () => repository.createOrReplayTurn({
      conversationId, userId, clientTurnId: 'pr10.3-concurrent',
    })));
    expect(new Set(attempts.map((item) => item?.turn.id)).size).toBe(1);
    expect(await prisma.novaTurn.count({ where: { conversationId, clientTurnId: 'pr10.3-concurrent' } })).toBe(1);
  });

  it('persiste turno, mensagens e estado semanticamente em uma transação', async () => {
    const { novaOrchestratorPersistence: repository } = await import('../nova-orchestrator-persistence.repository');
    const { prisma } = await import('@/lib/prisma');
    const now = new Date();
    const created = await repository.createOrReplayTurn({ conversationId, userId, clientTurnId: 'pr10.3-atomic' });
    const claim = await repository.claimTurn({ turnId: created!.turn.id, conversationId, userId, expectedVersion: created!.turn.version, owner: 'worker', now });
    const completed = await repository.completeReadOnlyTurn({
      turnId: claim!.id, conversationId, userId, expectedVersion: claim!.version,
      owner: claim!.processingOwner!, leaseToken: claim!.processingLeaseToken!, now: new Date(now.getTime() + 1),
      intentFamily: 'FINANCIAL_STATUS', focusCategory: 'LOAN', focusType: 'CATEGORY',
      focusReference: { kind: 'SET', setReference: 'LOAN', entityType: 'LOAN' },
      userContent: 'Minha senha: segredo123. Tenho empréstimo vencido?', assistantContent: 'Consulta real.',
    });
    expect(completed?.messages).toHaveLength(2);
    expect(completed?.messages[0]?.redacted).toBe(true);
    expect(await prisma.novaConversationState.count({ where: { conversationId, sourceTurnId: claim!.id } })).toBe(1);
    expect((await prisma.novaTurn.findUniqueOrThrow({ where: { id: claim!.id } })).status).toBe('COMPLETED');
  });

  it('lease antigo não finaliza após recovery e turno mais antigo não sobrescreve estado novo', async () => {
    const { novaOrchestratorPersistence: repository } = await import('../nova-orchestrator-persistence.repository');
    const { prisma } = await import('@/lib/prisma');
    const isolatedConversationId = (await prisma.novaConversation.create({
      data: { userId, channel: 'WEB', persona: 'LEGENDARY', status: 'ACTIVE', activeKey: `pr10.3-state:${userId}` },
    })).id;
    const first = await repository.createOrReplayTurn({ conversationId: isolatedConversationId, userId, clientTurnId: 'pr10.3-old-state' });
    const second = await repository.createOrReplayTurn({ conversationId: isolatedConversationId, userId, clientTurnId: 'pr10.3-new-state' });
    await prisma.novaTurn.update({ where: { id: first!.turn.id }, data: { createdAt: new Date('2026-08-09T10:00:00Z') } });
    await prisma.novaTurn.update({ where: { id: second!.turn.id }, data: { createdAt: new Date('2026-08-09T11:00:00Z') } });
    const claimOld = await repository.claimTurn({ turnId: first!.turn.id, conversationId: isolatedConversationId, userId, expectedVersion: first!.turn.version, owner: 'old', now: new Date('2026-08-09T12:00:00Z') });
    const claimNew = await repository.claimTurn({ turnId: second!.turn.id, conversationId: isolatedConversationId, userId, expectedVersion: second!.turn.version, owner: 'new', now: new Date('2026-08-09T12:00:00Z') });
    const common = { conversationId: isolatedConversationId, userId, now: new Date('2026-08-09T12:00:01Z'), intentFamily: 'FINANCIAL_STATUS', focusType: 'CATEGORY', userContent: 'Pergunta', assistantContent: 'Resposta' };
    await Promise.all([
      repository.completeReadOnlyTurn({ ...common, turnId: claimNew!.id, expectedVersion: claimNew!.version, owner: 'new', leaseToken: claimNew!.processingLeaseToken!, focusCategory: 'FINANCING', focusReference: { kind: 'SET', setReference: 'FINANCING', entityType: 'FINANCING' } }),
      repository.completeReadOnlyTurn({ ...common, turnId: claimOld!.id, expectedVersion: claimOld!.version, owner: 'old', leaseToken: claimOld!.processingLeaseToken!, focusCategory: 'LOAN', focusReference: { kind: 'SET', setReference: 'LOAN', entityType: 'LOAN' } }),
    ]);
    expect((await repository.getSemanticState({ conversationId: isolatedConversationId, userId, now: new Date('2026-08-09T12:00:02Z') }))?.focusCategory).toBe('FINANCING');
  });
});
