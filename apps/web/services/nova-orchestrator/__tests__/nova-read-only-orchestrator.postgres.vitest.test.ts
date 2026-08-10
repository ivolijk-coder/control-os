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
      advanceSemanticState: true,
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
    const common = { conversationId: isolatedConversationId, userId, now: new Date('2026-08-09T12:00:01Z'), intentFamily: 'FINANCIAL_STATUS', focusType: 'CATEGORY', advanceSemanticState: true, userContent: 'Pergunta', assistantContent: 'Resposta' };
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

    const contextFixture = {
      profile: { id: userId, name: 'PR10.3' },
      documents: { total: 0, pendingAnalysis: 0, failedAnalysis: 0 },
      operationalTasks: { pending: 0, waitingUser: 0 },
      runtime: { referenceDate: '2026-08-09', generatedAt: new Date('2026-08-09T18:00:00.000Z').toISOString(), timezone: 'America/Sao_Paulo' },
      coverage: [{ domain: 'PROFILE' as const, status: 'AVAILABLE' as const }],
    };

    async function buildService(overrides: { finances?: unknown; overview?: unknown; responder?: unknown } = {}) {
      const { NovaReadOnlyOrchestratorService } = await import('../nova-read-only-orchestrator.service');
      const { novaOrchestratorPersistence } = await import('../nova-orchestrator-persistence.repository');
      const finances = (overrides.finances as { getStatus: ReturnType<typeof vi.fn> }) ?? { getStatus: vi.fn().mockResolvedValue(statusFixture) };
      const overview = (overrides.overview as { getOverview: ReturnType<typeof vi.fn> }) ?? { getOverview: vi.fn() };
      // O provedor externo é sempre falso nos testes: nenhuma suíte deste
      // repositório pode depender de rede nem de `OPENAI_API_KEY`.
      const responder = (overrides.responder as { compose: ReturnType<typeof vi.fn> })
        ?? { compose: vi.fn().mockResolvedValue('Resposta composta em teste.') };
      const context = { getUserContext: vi.fn().mockResolvedValue(contextFixture) };
      const service = new NovaReadOnlyOrchestratorService({
        persistence: novaOrchestratorPersistence,
        finances: finances as never,
        overview: overview as never,
        context: context as never,
        responder,
        enabled: () => true,
        now: () => new Date('2026-08-09T18:00:00.000Z'),
        ownerId: () => `pilot-regression:${Math.random()}`,
      });
      return { service, finances, overview, responder, context };
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

    // P6 — BLOQUEANTE (PR10.4). Tradução automatizada dos Testes 2 e 4 do
    // piloto em produção: uma pergunta aberta no meio da conversa não pode
    // apagar o foco financeiro persistido. Antes desta PR o avanço de estado
    // era incondicional e este cenário perdia o contexto.
    it('P6 — pergunta não financeira não apaga o foco financeiro persistido', async () => {
      const { prisma } = await import('@/lib/prisma');
      const { novaOrchestratorPersistence: repository } = await import('../nova-orchestrator-persistence.repository');
      const isolated = (await prisma.novaConversation.create({
        data: { userId, channel: 'WEB', persona: 'NOVA', status: 'ACTIVE', activeKey: `pr10.4-focus:${userId}` },
      })).id;
      const at = new Date('2026-08-09T18:00:00.000Z');
      const readState = () => repository.getSemanticState({ conversationId: isolated, userId, now: at });

      const { service, responder } = await buildService();

      await service.process({ userId, conversationId: isolated, clientTurnId: 'pr10.4-focus-1', content: 'Tenho contas fixas em atraso?' });
      const afterFinancial = await readState();
      expect(afterFinancial?.focusCategory).toBe('FIXED_ACCOUNT');

      await service.process({ userId, conversationId: isolated, clientTurnId: 'pr10.4-focus-2', content: 'Você lembra do que conversamos ontem?' });
      expect(responder.compose).toHaveBeenCalledOnce();
      const afterOpen = await readState();
      // Estado intacto: mesma família, mesmo foco, mesma versão e mesmo
      // turno de origem — a pergunta aberta não disputou o estado.
      expect(afterOpen?.intentFamily).toBe('FINANCIAL_STATUS');
      expect(afterOpen?.focusCategory).toBe('FIXED_ACCOUNT');
      expect(afterOpen?.version).toBe(afterFinancial?.version);
      expect(afterOpen?.sourceTurnId).toBe(afterFinancial?.sourceTurnId);

      // E o follow-up anafórico continua recuperando o foco pelo estado.
      await service.process({ userId, conversationId: isolated, clientTurnId: 'pr10.4-focus-3', content: 'Quais são os valores?' });
      const followUp = await prisma.novaTurn.findFirstOrThrow({ where: { conversationId: isolated, clientTurnId: 'pr10.4-focus-3' } });
      expect(followUp.intentFamily).toBe('FINANCIAL_STATUS');
      expect(followUp.focusCategory).toBe('FIXED_ACCOUNT');
      expect(await prisma.novaConversationState.count({ where: { conversationId: isolated } })).toBe(1);
    });

    // R3 (B4) — a sequência REAL que revelou o defeito em produção, contra
    // PostgreSQL de verdade. Antes da correção, o quarto turno resolvia
    // FIXED_ACCOUNT: `Quando vence esse empréstimo?` não casa com nenhum
    // FINANCIAL_STATUS_PATTERNS (o padrão exige termo de atraso, e `vence` no
    // presente não está na lista), então a categoria explícita era descartada
    // e o foco persistido assumia.
    it('R3 — categoria explícita da mensagem vence o estado persistido divergente', async () => {
      const { prisma } = await import('@/lib/prisma');
      const isolated = (await prisma.novaConversation.create({
        data: { userId, channel: 'WEB', persona: 'NOVA', status: 'ACTIVE', activeKey: `b4-sequencia:${userId}` },
      })).id;
      const { service } = await buildService();
      const perguntas: Array<[string, string]> = [
        ['Tenho empréstimos em atraso?', 'LOAN'],
        ['Quando vence esse empréstimo?', 'LOAN'],
        ['Tenho contas fixas em atraso?', 'FIXED_ACCOUNT'],
        ['Quando vence esse empréstimo?', 'LOAN'],
      ];

      for (const [index, [content]] of perguntas.entries()) {
        await service.process({ userId, conversationId: isolated, clientTurnId: `b4-seq-${index}`, content });
      }

      const turnos = await prisma.novaTurn.findMany({ where: { conversationId: isolated }, orderBy: { createdAt: 'asc' } });
      expect(turnos).toHaveLength(4);
      for (const [index, [, esperado]] of perguntas.entries()) {
        expect(turnos[index]?.focusCategory).toBe(esperado);
        expect(turnos[index]?.status).toBe('COMPLETED');
      }
      // O estado final segue a última mensagem explícita, não a penúltima.
      const estado = await prisma.novaConversationState.findUniqueOrThrow({ where: { conversationId: isolated } });
      expect(estado.focusCategory).toBe('LOAN');
      expect(await prisma.novaConversationState.count({ where: { conversationId: isolated } })).toBe(1);
    });

    // R1/R7 (B4b) — contenção em PostgreSQL real: frase de mutação anafórica
    // com estado financeiro persistido continua sendo recusada. Antes da
    // correção, a referência resolvida vencia o roteamento e o turno saía
    // como FINANCIAL_STATUS.
    it('R7 — mutação anafórica com estado persistido continua bloqueada', async () => {
      const { prisma } = await import('@/lib/prisma');
      const isolated = (await prisma.novaConversation.create({
        data: { userId, channel: 'WEB', persona: 'NOVA', status: 'ACTIVE', activeKey: `b4-contencao:${userId}` },
      })).id;
      const { service, finances, responder } = await buildService();

      await service.process({ userId, conversationId: isolated, clientTurnId: 'b4-cont-1', content: 'Tenho empréstimos em atraso?' });
      const estadoAntes = await prisma.novaConversationState.findUniqueOrThrow({ where: { conversationId: isolated } });
      finances.getStatus.mockClear();

      await service.process({ userId, conversationId: isolated, clientTurnId: 'b4-cont-2', content: 'Cancele esse empréstimo' });

      const bloqueado = await prisma.novaTurn.findFirstOrThrow({ where: { conversationId: isolated, clientTurnId: 'b4-cont-2' } });
      expect(bloqueado.status).toBe('COMPLETED');
      expect(bloqueado.intentFamily).toBe('BLOCKED_MUTATION');
      expect(bloqueado.focusCategory).toBeNull();
      expect(finances.getStatus).not.toHaveBeenCalled();
      expect(responder.compose).not.toHaveBeenCalled();

      // Estado semântico intacto: o pedido recusado não move o foco.
      const estadoDepois = await prisma.novaConversationState.findUniqueOrThrow({ where: { conversationId: isolated } });
      expect(estadoDepois.version).toBe(estadoAntes.version);
      expect(estadoDepois.focusCategory).toBe(estadoAntes.focusCategory);
      expect(estadoDepois.sourceTurnId).toBe(estadoAntes.sourceTurnId);
      expect(await prisma.novaPendingConfirmation.count({ where: { conversationId: isolated } })).toBe(0);
    });

    // P9 — idempotência preservada na capacidade nova: replay não paga uma
    // segunda chamada ao provedor externo nem duplica mensagens.
    it('P9 — replay de pergunta aberta não chama o provedor duas vezes nem duplica mensagens', async () => {
      const { prisma } = await import('@/lib/prisma');
      const isolated = (await prisma.novaConversation.create({
        data: { userId, channel: 'WEB', persona: 'NOVA', status: 'ACTIVE', activeKey: `pr10.4-replay:${userId}` },
      })).id;
      const responder = { compose: vi.fn().mockResolvedValue('Resposta composta em teste.') };
      const { service } = await buildService({ responder });

      const first = await service.process({ userId, conversationId: isolated, clientTurnId: 'pr10.4-replay-1', content: 'Como você funciona por aqui?' });
      const second = await service.process({ userId, conversationId: isolated, clientTurnId: 'pr10.4-replay-1', content: 'Como você funciona por aqui?' });

      expect(responder.compose).toHaveBeenCalledOnce();
      expect(first.kind === 'RESULT' && first.result.status).toBe('COMPLETED');
      expect(second.kind === 'RESULT' && second.result.status).toBe('COMPLETED');
      expect(await prisma.novaTurn.count({ where: { conversationId: isolated, clientTurnId: 'pr10.4-replay-1' } })).toBe(1);
      expect(await prisma.novaMessage.count({ where: { conversationId: isolated } })).toBe(2);
    });
  });
});
