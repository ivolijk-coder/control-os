import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/services/financial-intelligence/financial-intelligence.sources', () => ({
  financialIntelligenceService: { getStatus: vi.fn() },
}));

import { ActionRegistry, DEFAULT_ACTION_HANDLERS } from '@/services/action-engine/action-registry';
import { FinancialStatusAction } from '@/services/action-engine/actions/finance/get-financial-status.action';
import { ActionCapabilityRegistry, capabilityRegistry } from '@/services/decision-engine/capability-registry';
import type { FinancialIntelligenceService, FinancialStatusDTO } from '@/services/financial-intelligence';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';

const status: FinancialStatusDTO = {
  referenceDate: '2026-08-02T00:00:00.000Z',
  totalOverdue: 3600,
  overdueCount: 3,
  categories: [],
  upcomingCommitments: [],
  availableBalance: 17965,
  projectedBalance: 14365,
  projectionHorizonDays: 30,
  dataCoverage: [],
  generatedAt: '2026-08-02T12:00:00.000Z',
};

describe('FinancialStatusAction', () => {
  const getStatus = vi.fn<FinancialIntelligenceService['getStatus']>();
  const service: FinancialIntelligenceService = { getStatus };

  beforeEach(() => {
    getStatus.mockReset();
    getStatus.mockResolvedValue(status);
  });

  it('aparece no capability registry sem parâmetros arbitrários', () => {
    const action = new FinancialStatusAction(service);
    const registry = new ActionCapabilityRegistry([action]);

    expect(registry.find('financial_status.get')).toEqual(action.capability);
    expect(registry.list()).toEqual([expect.objectContaining({
      kind: 'financial_status.get',
      parameters: [],
    })]);
    expect(capabilityRegistry.find('financial_status.get')).toEqual(expect.objectContaining({
      kind: 'financial_status.get',
      parameters: [],
    }));
    expect(DEFAULT_ACTION_HANDLERS.some((handler) => handler.kind === 'financial_status.get')).toBe(true);
  });

  it('é registrado no action registry e retorna o FinancialStatusDTO', async () => {
    const registry = new ActionRegistry([new FinancialStatusAction(service)]);

    const [result] = await registry.execute([
      { kind: 'financial_status.get', payload: {} },
    ], 'user-authenticated');

    expect(result).toEqual({
      success: true,
      message: 'Situação financeira consultada com sucesso.',
      data: status,
    });
  });

  it('usa somente o userId do contexto autenticado e ignora o payload', async () => {
    const action = new FinancialStatusAction(service);

    await runAsFinanceUser('user-authenticated', () => action.execute({
      userId: 'user-from-model',
      referenceDate: '1999-01-01',
      arbitrary: true,
    }));

    expect(getStatus).toHaveBeenCalledOnce();
    expect(getStatus).toHaveBeenCalledWith('user-authenticated');
  });

  it('não executa consulta sem contexto autenticado', async () => {
    const result = await new FinancialStatusAction(service).execute({ userId: 'external' });

    expect(result.success).toBe(false);
    expect(getStatus).not.toHaveBeenCalled();
  });

  it('trata falha do serviço sem expor detalhes internos', async () => {
    getStatus.mockRejectedValue(new Error('internal database detail'));

    const result = await runAsFinanceUser('user-authenticated', () =>
      new FinancialStatusAction(service).execute({})
    );

    expect(result).toEqual({
      success: false,
      message: 'Não foi possível consultar sua situação financeira agora.',
    });
    expect(JSON.stringify(result)).not.toContain('database');
  });

  it('é somente leitura e depende apenas de getStatus', async () => {
    const readOnlyService = { getStatus } satisfies FinancialIntelligenceService;

    await runAsFinanceUser('user-authenticated', () =>
      new FinancialStatusAction(readOnlyService).execute({})
    );

    expect(Object.keys(readOnlyService)).toEqual(['getStatus']);
    expect(getStatus).toHaveBeenCalledWith('user-authenticated');
  });
});
