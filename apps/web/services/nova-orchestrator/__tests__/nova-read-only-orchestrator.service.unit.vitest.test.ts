import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
// `nova-read-only-orchestrator.service.ts` importa `novaOrchestratorPersistence`
// (o singleton real) só para o valor padrão do construtor — todo teste deste
// arquivo injeta seu próprio `persistence` fake, então o singleton nunca é
// usado de fato. Mas o import ainda é avaliado no carregamento do módulo, e
// `nova-orchestrator-persistence.repository.ts` importa `Prisma` de
// `@prisma/client` como valor (não só tipo). Neste ambiente de sandbox, o
// binário nativo do Prisma Query Engine não pode ser gerado (download
// bloqueado pela rede — mesma limitação pré-existente e não relacionada a
// este hotfix), então esse import falha antes mesmo de qualquer teste
// rodar. Mesmo padrão já usado em
// `financial-contract.service.unit.vitest.test.ts` para o mesmo problema.
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@prisma/client', () => ({ Prisma: { JsonNull: null, sql: () => ({}) } }));

import { NovaReadOnlyOrchestratorService } from '../nova-read-only-orchestrator.service';

const now = new Date('2026-08-09T18:00:00.000Z');
const status = {
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
  ], generatedAt: now.toISOString(),
};

function harness(overrides: Record<string, unknown> = {}) {
  const persisted = [
    { id: 'm-user', role: 'USER' as const, content: 'Tenho empréstimos em atraso?', intent: 'FINANCIAL_STATUS', redacted: false, createdAt: now },
    { id: 'm-assistant', role: 'ASSISTANT' as const, content: 'Resposta real', intent: 'FINANCIAL_STATUS', redacted: false, createdAt: now },
  ];
  const persistence = {
    findAccessibleActiveWebConversation: vi.fn().mockResolvedValue({ id: 'conversation', userId: 'user', persona: 'NOVA' }),
    createOrReplayTurn: vi.fn().mockResolvedValue({ turn: { id: 'turn', version: 1 }, replayed: false }),
    replayTurn: vi.fn(),
    claimTurn: vi.fn().mockResolvedValue({ id: 'turn', version: 2, processingOwner: 'owner', processingLeaseToken: 'lease' }),
    getSemanticState: vi.fn().mockResolvedValue(null),
    listRecentMessages: vi.fn().mockResolvedValue([]),
    completeReadOnlyTurn: vi.fn().mockResolvedValue({ turn: { id: 'turn' }, messages: persisted }),
    failTurn: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
  const finances = { getStatus: vi.fn().mockResolvedValue(status) };
  const overview = { getOverview: vi.fn() };
  const service = new NovaReadOnlyOrchestratorService({
    persistence: persistence as never, finances, overview: overview as never,
    enabled: () => true, now: () => now, ownerId: () => 'owner',
  });
  return { service, persistence, finances, overview };
}

describe('NovaReadOnlyOrchestratorService', () => {
  it('não cria turno quando a flag está desligada', async () => {
    const { persistence } = harness();
    const service = new NovaReadOnlyOrchestratorService({
      persistence: persistence as never, finances: { getStatus: vi.fn() }, overview: { getOverview: vi.fn() } as never,
      enabled: () => false, now: () => now, ownerId: () => 'owner',
    });
    await expect(service.process({ userId: 'user', conversationId: 'conversation', clientTurnId: 'client', content: 'Tenho dívida?' })).resolves.toEqual({ kind: 'DISABLED' });
    expect(persistence.createOrReplayTurn).not.toHaveBeenCalled();
  });

  it('consulta Financial Intelligence diretamente e conclui o par atomicamente', async () => {
    const { service, persistence, finances } = harness();
    const outcome = await service.process({ userId: 'user', conversationId: 'conversation', clientTurnId: 'client', content: 'Tenho empréstimos em atraso?' });
    expect(finances.getStatus).toHaveBeenCalledOnce();
    expect(finances.getStatus).toHaveBeenCalledWith('user');
    expect(persistence.completeReadOnlyTurn).toHaveBeenCalledWith(expect.objectContaining({ intentFamily: 'FINANCIAL_STATUS', focusCategory: 'LOAN' }));
    expect(outcome.kind === 'RESULT' && outcome.result.status).toBe('COMPLETED');
  });

  it('replay COMPLETED não consulta novamente as fontes', async () => {
    const messages = [{ id: 'm', role: 'ASSISTANT' as const, content: 'Persistida', intent: 'FINANCIAL_STATUS', redacted: false, createdAt: now }];
    const { service, finances } = harness({
      createOrReplayTurn: vi.fn().mockResolvedValue({ turn: { id: 'turn', version: 4 }, replayed: true }),
      replayTurn: vi.fn().mockResolvedValue({ kind: 'COMPLETED', turn: { id: 'turn' }, messages }),
    });
    const outcome = await service.process({ userId: 'user', conversationId: 'conversation', clientTurnId: 'client', content: 'Quanto?' });
    expect(finances.getStatus).not.toHaveBeenCalled();
    expect(outcome).toEqual({ kind: 'RESULT', result: { status: 'COMPLETED', turnId: 'turn', messages: [expect.objectContaining({ content: 'Persistida' })] } });
  });

  it('mutações são bloqueadas sem chamar fonte financeira', async () => {
    const { service, finances, persistence } = harness();
    await service.process({ userId: 'user', conversationId: 'conversation', clientTurnId: 'client', content: 'Cancele esta despesa' });
    expect(finances.getStatus).not.toHaveBeenCalled();
    expect(persistence.completeReadOnlyTurn).toHaveBeenCalledWith(expect.objectContaining({ assistantContent: expect.stringContaining('Nenhuma alteração') }));
  });

  it('falha de fonte encerra o turno sem inventar resposta', async () => {
    const { service, persistence, finances } = harness();
    finances.getStatus.mockRejectedValueOnce(new Error('database secret'));
    const outcome = await service.process({ userId: 'user', conversationId: 'conversation', clientTurnId: 'client', content: 'Estou devendo?' });
    expect(persistence.failTurn).toHaveBeenCalledOnce();
    expect(outcome.kind === 'RESULT' && outcome.result).toEqual(expect.objectContaining({ status: 'FAILED', error: expect.objectContaining({ code: 'SOURCE_UNAVAILABLE' }) }));
    expect(JSON.stringify(outcome)).not.toContain('database secret');
  });

  // Regressão do bug real do piloto PR10.3: `process()` recebe `content`,
  // mas `createOrReplayTurn` (fronteira `CreateOrReplayTurnInput`) só pode
  // receber os 3 campos persistíveis de `NovaTurn` — nunca o `input` inteiro.
  it('content nunca atravessa para createOrReplayTurn — fronteira CreateOrReplayTurnInput', async () => {
    const { service, persistence } = harness();
    await service.process({ userId: 'user', conversationId: 'conversation', clientTurnId: 'client', content: 'Tenho empréstimos em atraso?' });
    expect(persistence.createOrReplayTurn).toHaveBeenCalledOnce();
    const [calledWith] = persistence.createOrReplayTurn.mock.calls[0] as [Record<string, unknown>];
    expect(calledWith).toEqual({ conversationId: 'conversation', userId: 'user', clientTurnId: 'client' });
    expect(Object.keys(calledWith).sort()).toEqual(['clientTurnId', 'conversationId', 'userId']);
    expect(calledWith).not.toHaveProperty('content');
  });

  it('quando createOrReplayTurn recebe input com content indevidamente anexado (bypass de tipo), o objeto repassado ao Prisma continua explícito no repository — este teste documenta que a defesa vive em nova-orchestrator-persistence.repository.ts, não apenas aqui', async () => {
    // A defesa de runtime (construção explícita de `data` campo a campo) vive
    // no repository, coberto pelo teste PostgreSQL "mesmo com bypass de tipo,
    // content nunca alcança o Prisma". Este teste unitário garante apenas que
    // a CAMADA DE CHAMADA (o service) já faz a sua parte: nunca repassa o
    // `input` inteiro, só o objeto explícito de 3 campos.
    const { service, persistence } = harness();
    const input = { userId: 'user', conversationId: 'conversation', clientTurnId: 'client', content: 'x' };
    await service.process(input);
    const [calledWith] = persistence.createOrReplayTurn.mock.calls[0] as [Record<string, unknown>];
    expect(calledWith).not.toBe(input); // objeto novo, não o `input` original repassado por referência
  });

  it('claim perdido (corrida) não consulta Financial Intelligence nem DailyOverview', async () => {
    const { service, finances, overview, persistence } = harness({ claimTurn: vi.fn().mockResolvedValue(null) });
    const outcome = await service.process({ userId: 'user', conversationId: 'conversation', clientTurnId: 'client', content: 'Tenho dívida?' });
    expect(finances.getStatus).not.toHaveBeenCalled();
    expect(overview.getOverview).not.toHaveBeenCalled();
    expect(persistence.completeReadOnlyTurn).not.toHaveBeenCalled();
    expect(outcome).toEqual({ kind: 'RESULT', result: { status: 'PROCESSING', turnId: 'turn' } });
  });

  it('erro inesperado em createOrReplayTurn propaga como exceção, sem tocar fontes financeiras nem confirmar/mutar nada', async () => {
    const { service, persistence, finances, overview } = harness({ createOrReplayTurn: vi.fn().mockRejectedValue(new Error('db indisponível')) });
    await expect(
      service.process({ userId: 'user', conversationId: 'conversation', clientTurnId: 'client', content: 'Tenho dívida?' })
    ).rejects.toThrow('db indisponível');
    expect(finances.getStatus).not.toHaveBeenCalled();
    expect(overview.getOverview).not.toHaveBeenCalled();
    expect(persistence.completeReadOnlyTurn).not.toHaveBeenCalled();
    expect(persistence.failTurn).not.toHaveBeenCalled();
  });

  it('nenhuma mutação, confirmação (Action Registry) ou dependência de OpenAI é acionada num fluxo somente leitura', async () => {
    const createConfirmation = vi.fn();
    const finalizeConfirmation = vi.fn();
    const claimConfirmation = vi.fn();
    const { service } = harness({ createConfirmation, finalizeConfirmation, claimConfirmation });
    await service.process({ userId: 'user', conversationId: 'conversation', clientTurnId: 'client', content: 'Tenho empréstimos em atraso?' });
    expect(createConfirmation).not.toHaveBeenCalled();
    expect(finalizeConfirmation).not.toHaveBeenCalled();
    expect(claimConfirmation).not.toHaveBeenCalled();
  });
});
