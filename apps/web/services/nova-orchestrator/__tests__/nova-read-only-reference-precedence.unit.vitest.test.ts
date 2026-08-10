import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@prisma/client', () => ({ Prisma: { JsonNull: null, sql: () => ({}) } }));

import { NovaReadOnlyOrchestratorService } from '../nova-read-only-orchestrator.service';
import { resolveReadOnlyFinancialReference } from '../nova-reference-resolver';
import { routeNovaReadOnlyMessage } from '../nova-read-only-routing';

const now = new Date('2026-08-10T02:00:00.000Z');

/** Estado semântico persistido, no formato que `getSemanticState` devolve. */
function state(focusCategory: string) {
  return {
    conversationId: 'conversation',
    userId: 'user',
    intentFamily: 'FINANCIAL_STATUS',
    focusCategory,
    focusType: 'CATEGORY',
    focusReference: { kind: 'SET' as const, setReference: focusCategory, entityType: focusCategory },
    sourceTurnId: 'turn-anterior',
    version: 8,
    expiresAt: new Date(now.getTime() + 86_400_000),
    updatedAt: now,
  };
}

const userContext = {
  profile: { id: 'user', name: 'Ivoli' },
  documents: { total: 0, pendingAnalysis: 0, failedAnalysis: 0 },
  operationalTasks: { pending: 0, waitingUser: 0 },
  runtime: { referenceDate: '2026-08-10', generatedAt: now.toISOString(), timezone: 'America/Sao_Paulo' },
  coverage: [{ domain: 'PROFILE' as const, status: 'AVAILABLE' as const }],
};

const status = {
  referenceDate: '2026-08-10', totalOverdue: 3600, overdueCount: 1,
  categories: [{ type: 'LOAN' as const, count: 1, total: 3600, items: [] }],
  upcomingCommitments: [], availableBalance: 0, projectedBalance: null,
  projectionHorizonDays: 30,
  dataCoverage: [{ source: 'TRANSACTIONS' as const, status: 'AVAILABLE' as const }],
  generatedAt: now.toISOString(),
};

function harness(semanticState: ReturnType<typeof state> | null) {
  const persistence = {
    findAccessibleActiveWebConversation: vi.fn().mockResolvedValue({ id: 'conversation', userId: 'user', persona: 'NOVA' }),
    createOrReplayTurn: vi.fn().mockResolvedValue({ turn: { id: 'turn', version: 1 }, replayed: false }),
    replayTurn: vi.fn(),
    claimTurn: vi.fn().mockResolvedValue({ id: 'turn', version: 2, processingOwner: 'owner', processingLeaseToken: 'lease' }),
    getSemanticState: vi.fn().mockResolvedValue(semanticState),
    listRecentMessages: vi.fn().mockResolvedValue([]),
    completeReadOnlyTurn: vi.fn().mockResolvedValue({ turn: { id: 'turn' }, messages: [] }),
    failTurn: vi.fn().mockResolvedValue(true),
    // Espiões de confirmação persistente: nenhum destes pode ser chamado em
    // fluxo somente leitura, com ou sem estado, com ou sem anáfora.
    createConfirmation: vi.fn(),
    claimConfirmation: vi.fn(),
    finalizeConfirmation: vi.fn(),
  };
  const finances = { getStatus: vi.fn().mockResolvedValue(status) };
  const overview = { getOverview: vi.fn().mockResolvedValue({}) };
  const context = { getUserContext: vi.fn().mockResolvedValue(userContext) };
  const responder = { compose: vi.fn().mockResolvedValue('Resposta composta.') };
  const service = new NovaReadOnlyOrchestratorService({
    persistence: persistence as never, finances, overview: overview as never,
    context, responder, enabled: () => true, now: () => now, ownerId: () => 'owner',
  });
  return { service, persistence, finances, overview, context, responder };
}

const send = (content: string) => ({ userId: 'user', conversationId: 'conversation', clientTurnId: 'client', content });

const BLOCKED_TEXT = 'Essa operação não está disponível neste fluxo somente leitura. Nenhuma alteração foi realizada.';

// ---------------------------------------------------------------------------
// R1 — categoria explícita da mensagem vence o estado persistido divergente
// ---------------------------------------------------------------------------
describe('B4a — R1: categoria explícita vence estado persistido', () => {
  it('resolver: "Quando vence esse empréstimo?" com estado FIXED_ACCOUNT resolve LOAN', () => {
    const result = resolveReadOnlyFinancialReference({
      message: 'Quando vence esse empréstimo?',
      semanticState: state('FIXED_ACCOUNT') as never,
      recentMessages: [],
    });
    expect(result).toEqual({
      intentFamily: 'FINANCIAL_STATUS', focusCategory: 'LOAN', focusType: 'CATEGORY', setReference: 'LOAN',
    });
  });

  it.each([
    ['Quando vence essa fatura?', 'LOAN', 'CARD_STATEMENT'],
    ['Quando vence esse financiamento?', 'FIXED_ACCOUNT', 'FINANCING'],
    ['Quais são essas contas fixas?', 'LOAN', 'FIXED_ACCOUNT'],
  ])('resolver: %s com estado %s resolve %s', (message, persisted, expected) => {
    const result = resolveReadOnlyFinancialReference({
      message, semanticState: state(persisted) as never, recentMessages: [],
    });
    expect(result?.focusCategory).toBe(expected);
    expect(result?.focusType).toBe('CATEGORY');
    expect(result?.setReference).toBe(expected);
  });

  it('serviço: o turno é persistido com a categoria da mensagem, não a do estado', async () => {
    const { service, persistence, finances } = harness(state('FIXED_ACCOUNT'));
    await service.process(send('Quando vence esse empréstimo?'));
    expect(finances.getStatus).toHaveBeenCalledOnce();
    expect(persistence.completeReadOnlyTurn).toHaveBeenCalledWith(expect.objectContaining({
      intentFamily: 'FINANCIAL_STATUS', focusCategory: 'LOAN', advanceSemanticState: true,
    }));
  });
});

// ---------------------------------------------------------------------------
// R2 — anáfora legítima continua recuperando o estado (não regride Testes 2/4)
// ---------------------------------------------------------------------------
describe('B4a — R2: anáfora sem categoria explícita continua usando o estado', () => {
  it.each([
    ['Quais são os valores?', 'FIXED_ACCOUNT'],
    ['Quanto?', 'LOAN'],
    ['E o outro?', 'FINANCING'],
  ])('%s com estado %s mantém o foco persistido', (message, persisted) => {
    const result = resolveReadOnlyFinancialReference({
      message, semanticState: state(persisted) as never, recentMessages: [],
    });
    expect(result?.focusCategory).toBe(persisted);
  });

  it('serviço: follow-up elíptico preserva o foco e avança o estado', async () => {
    const { service, persistence } = harness(state('FIXED_ACCOUNT'));
    await service.process(send('Quais são os valores?'));
    expect(persistence.completeReadOnlyTurn).toHaveBeenCalledWith(expect.objectContaining({
      focusCategory: 'FIXED_ACCOUNT', advanceSemanticState: true,
    }));
  });
});

// ---------------------------------------------------------------------------
// R5 — o fallback por mensagens recentes também respeita a categoria explícita
// ---------------------------------------------------------------------------
describe('B4a — R5: fallback por histórico respeita a categoria explícita', () => {
  it('mensagem atual com categoria vence a categoria recuperada do histórico', () => {
    const result = resolveReadOnlyFinancialReference({
      message: 'Quando vence esse empréstimo?',
      semanticState: null,
      recentMessages: [{ role: 'USER', content: 'Tenho financiamentos vencidos?', intent: 'FINANCIAL_STATUS' }],
    });
    expect(result?.focusCategory).toBe('LOAN');
  });

  it('sem categoria explícita, o histórico continua mandando', () => {
    const result = resolveReadOnlyFinancialReference({
      message: 'E o outro?',
      semanticState: null,
      recentMessages: [{ role: 'USER', content: 'Tenho financiamentos vencidos?', intent: 'FINANCIAL_STATUS' }],
    });
    expect(result?.focusCategory).toBe('FINANCING');
  });
});

// ---------------------------------------------------------------------------
// R7 — matriz canônica de contenção. Substitui o P2 da PR10.4, que só cobria
// o quadrante "sem estado + sem anáfora" — justamente onde a contenção
// funcionava. Cada frase roda nos quatro quadrantes.
// ---------------------------------------------------------------------------
describe('B4b — R7 (canônico): contenção de mutação em todos os quadrantes', () => {
  const comAnafora = ['Cancele esse empréstimo', 'Pague essa conta fixa', 'Exclua essa despesa', 'Estorne essa transferência'];
  const semAnafora = ['Cancele o empréstimo do Bradesco', 'Pague a conta fixa de luz', 'Exclua a despesa de ontem', 'Cadastre uma despesa de 100 reais'];
  const quadrantes: Array<[string, ReturnType<typeof state> | null, string[]]> = [
    ['sem estado + sem anáfora', null, semAnafora],
    ['sem estado + com anáfora', null, comAnafora],
    ['com estado + sem anáfora', state('FIXED_ACCOUNT'), semAnafora],
    ['com estado + com anáfora', state('FIXED_ACCOUNT'), comAnafora],
  ];

  for (const [quadrante, semanticState, frases] of quadrantes) {
    describe(quadrante, () => {
      it.each(frases)('%s → BLOCKED_MUTATION, sem provedor e sem mutação', async (message) => {
        const { service, persistence, responder, context, finances, overview } = harness(semanticState);
        await service.process(send(message));

        // roteamento determinístico continua classificando como mutação
        expect(routeNovaReadOnlyMessage(message)).toEqual({ kind: 'BLOCKED_MUTATION' });
        // resposta é a recusa canônica, com texto exato
        expect(persistence.completeReadOnlyTurn).toHaveBeenCalledWith(expect.objectContaining({
          assistantContent: BLOCKED_TEXT,
        }));
        // nenhuma fonte, nenhum contexto, nenhum provedor externo é acionado
        expect(responder.compose).not.toHaveBeenCalled();
        expect(context.getUserContext).not.toHaveBeenCalled();
        expect(finances.getStatus).not.toHaveBeenCalled();
        expect(overview.getOverview).not.toHaveBeenCalled();
      });
    });
  }

  it('mutação bloqueada não avança nem contamina o estado semântico', async () => {
    const { service, persistence } = harness(state('FIXED_ACCOUNT'));
    await service.process(send('Cancele esse empréstimo'));
    expect(persistence.completeReadOnlyTurn).toHaveBeenCalledWith(expect.objectContaining({
      advanceSemanticState: false, focusCategory: null, focusType: null, focusReference: null,
    }));
  });

  it('nenhuma confirmação persistente é criada em qualquer quadrante', async () => {
    for (const semanticState of [null, state('FIXED_ACCOUNT')]) {
      for (const message of [...comAnafora, ...semAnafora]) {
        const { service, persistence } = harness(semanticState);
        await service.process(send(message));
        expect(persistence.createConfirmation).not.toHaveBeenCalled();
        expect(persistence.claimConfirmation).not.toHaveBeenCalled();
        expect(persistence.finalizeConfirmation).not.toHaveBeenCalled();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Não regressão da PR10.4
// ---------------------------------------------------------------------------
describe('PR10.4 — não regressão', () => {
  it('P6: pergunta aberta continua sem avançar o estado semântico', async () => {
    const { service, persistence, responder } = harness(state('FIXED_ACCOUNT'));
    await service.process(send('Como você organiza minhas informações por aqui?'));
    expect(responder.compose).toHaveBeenCalledOnce();
    expect(persistence.completeReadOnlyTurn).toHaveBeenCalledWith(expect.objectContaining({
      intentFamily: 'OPEN_QUESTION', advanceSemanticState: false, focusCategory: null,
    }));
  });

  it('consulta financeira direta continua determinística', async () => {
    const { service, persistence, responder } = harness(null);
    await service.process(send('Tenho contas fixas em atraso?'));
    expect(responder.compose).not.toHaveBeenCalled();
    expect(persistence.completeReadOnlyTurn).toHaveBeenCalledWith(expect.objectContaining({
      intentFamily: 'FINANCIAL_STATUS', focusCategory: 'FIXED_ACCOUNT',
    }));
  });
});
