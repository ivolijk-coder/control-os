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

  // Regressão do bug real do piloto PR10.3 (HTTP 500 / nova_turns = 0):
  // `NovaReadOnlyOrchestratorService.process()` recebia `content`, repassava
  // o `input` inteiro para `createOrReplayTurn`, e o repository fazia
  // `prisma.novaTurn.create({ data: input })` — `content` não existe em
  // `NovaTurn`, então o Prisma falhava antes do INSERT
  // (`PrismaClientValidationError: Unknown argument content`).
  //
  // Os testes acima só chamam `repository.createOrReplayTurn` diretamente,
  // SEM `content` — por isso nunca capturaram o bug. Os testes abaixo
  // passam pelo `NovaReadOnlyOrchestratorService` completo (mesmo caminho
  // da rota HTTP real), com Prisma de verdade.
  describe('process() completo através do NovaReadOnlyOrchestratorService (PostgreSQL real)', () => {
    const statusFixture = {
      referenceDate: '2026-08-09', totalOverdue: 3600, overdueCount: 1,
      categories: [{ type: 'LOAN' as const, count: 1, total: 3600, items: [{ id: 'loan-1', source: 'FINANCIAL_CONTRACTS' as const, sourceType: 'LOAN' as const, title: 'Nubank', amount: 3600, dueDate: '2026-08-01', status: 'OVERDUE' as const, daysOverdue: 8 }] }],
      upcomingCommitments: [], availableBalance: 1000, projectedBalance: null,
      projectionHorizonDays: 30,
      dataCoverage: [
        { source: 'TRANSACTIONS' as const, status: 'AVAILABLE' as const },
        { source: 'ACCOUNTS' as const, status: 'AVAILABLE' as const },
        { source: 'FIXED_ACCOUNTS' as const, status: 'AVAILABLE' as const },
        { source: 'FINANCIAL_CONTRACTS' as const, status: 'AVAILABLE' as const },
        { source: 'CARDS' as const, status: 'NOT_IMPLEMENTED' as const },
      ], generatedAt: new Date('2026-08-09T18:00:00.000Z').toISOString(),
    };

    async function buildService(overrides: { finances?: unknown; overview?: unknown } = {}) {
      const { NovaReadOnlyOrchestratorService } = await import('../nova-read-only-orchestrator.service');
      const { novaOrchestratorPersistence } = await import('../nova-orchestrator-persistence.repository');
      const finances = (overrides.finances as { getStatus: ReturnType<typeof vi.fn> }) ?? { getStatus: vi.fn().mockResolvedValue(statusFixture) };
      const overview = (overrides.overview as { getOverview: ReturnType<typeof vi.fn> }) ?? { getOverview: vi.fn() };
      const service = new NovaReadOnlyOrchestratorService({
        persistence: novaOrchestratorPersistence,
        finances: finances as never,
        overview: overview as never,
        enabled: () => true,
        now: () => new Date('2026-08-09T18:00:00.000Z'),
        ownerId: () => `pilot-regression:${Math.random()}`,
      });
      return { service, finances, overview };
    }

    it('process() com content cria exatamente um NovaTurn de verdade (bug original: PrismaClientValidationError antes do INSERT)', async () => {
      const { prisma } = await import('@/lib/prisma');
      const { service, finances } = await buildService();
      const before = await prisma.novaTurn.count({ where: { conversationId, clientTurnId: 'pr10.3-hotfix-happy-path' } });
      expect(before).toBe(0);

      const outcome = await service.process({
        userId, conversationId, clientTurnId: 'pr10.3-hotfix-happy-path',
        content: 'Tenho empréstimos em atraso?',
      });

      expect(outcome.kind).toBe('RESULT');
      expect(outcome.kind === 'RESULT' && outcome.result.status).toBe('COMPLETED');
      expect(finances.getStatus).toHaveBeenCalledWith(userId);
      const turns = await prisma.novaTurn.findMany({ where: { conversationId, clientTurnId: 'pr10.3-hotfix-happy-path' } });
      expect(turns).toHaveLength(1);
      expect(turns[0]?.status).toBe('COMPLETED');
    });

    it('5 retries concorrentes com o mesmo clientTurnId, através do serviço completo, convergem para um único NovaTurn', async () => {
      const { prisma } = await import('@/lib/prisma');
      const attempts = await Promise.all(
        Array.from({ length: 5 }, async () => {
          const { service } = await buildService();
          return service.process({ userId, conversationId, clientTurnId: 'pr10.3-hotfix-five-retries', content: 'Tenho empréstimos em atraso?' });
        })
      );
      for (const outcome of attempts) expect(outcome.kind).toBe('RESULT');
      const turnIds = new Set(
        attempts.map((outcome) => (outcome.kind === 'RESULT' && 'turnId' in outcome.result ? outcome.result.turnId : null))
      );
      expect(turnIds.size).toBe(1);
      expect(await prisma.novaTurn.count({ where: { conversationId, clientTurnId: 'pr10.3-hotfix-five-retries' } })).toBe(1);
    });

    it('ownership inválido continua protegido através do serviço completo (NOT_FOUND, nenhum turno criado, nenhuma fonte financeira consultada)', async () => {
      const { prisma } = await import('@/lib/prisma');
      const { service, finances } = await buildService();
      const outcome = await service.process({
        userId: otherUserId, conversationId, clientTurnId: 'pr10.3-hotfix-foreign-owner',
        content: 'Tenho empréstimos em atraso?',
      });
      expect(outcome).toEqual({ kind: 'NOT_FOUND' });
      expect(finances.getStatus).not.toHaveBeenCalled();
      expect(await prisma.novaTurn.count({ where: { conversationId, clientTurnId: 'pr10.3-hotfix-foreign-owner' } })).toBe(0);
    });

    it('mesmo com bypass de tipo (objeto largo simulando um chamador futuro descuidado), content nunca alcança o Prisma novaTurn.create', async () => {
      const { prisma } = await import('@/lib/prisma');
      const { novaOrchestratorPersistence: repository } = await import('../nova-orchestrator-persistence.repository');
      const widened = {
        conversationId, userId, clientTurnId: 'pr10.3-hotfix-leak-guard',
        content: 'isto NUNCA pode chegar ao prisma.novaTurn.create',
      } as unknown as Parameters<typeof repository.createOrReplayTurn>[0];

      const created = await repository.createOrReplayTurn(widened);

      expect(created).not.toBeNull();
      const row = await prisma.novaTurn.findUniqueOrThrow({ where: { id: created!.turn.id } });
      expect(row.conversationId).toBe(conversationId);
      expect(row.userId).toBe(userId);
      expect(row.clientTurnId).toBe('pr10.3-hotfix-leak-guard');
      // `NovaTurn` não tem coluna `content` — se o Prisma tivesse recebido
      // esse campo (bug original), `create` teria lançado
      // `PrismaClientValidationError` antes do INSERT. Chegar até aqui já
      // prova, contra o banco real, que a fronteira segura funciona mesmo
      // quando o TypeScript é contornado.
    });
  });
});
