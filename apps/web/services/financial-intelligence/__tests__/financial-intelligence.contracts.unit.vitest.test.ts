import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  DATA_COVERAGE_STATUSES,
  FINANCIAL_DATA_SOURCES,
  FINANCIAL_OBLIGATION_CATEGORIES,
  buildFinancialDataCoverage,
  calculateDaysOverdue,
  groupOverdueCommitments,
  normalizeFinancialCommitment,
} from '..';
import type {
  DataCoverageStatus,
  FinancialCommitmentDTO,
  FinancialDataSource,
  FinancialObligationCategory,
  FinancialStatusDTO,
} from '..';

const REFERENCE_DATE = '2026-08-10T15:30:00.000Z';

function commitment(overrides: Partial<FinancialCommitmentDTO> = {}): FinancialCommitmentDTO {
  return {
    id: 'commitment-1',
    source: 'FIXED_ACCOUNTS',
    sourceType: 'FIXED_ACCOUNT',
    title: 'Condomínio',
    amount: 250.5,
    dueDate: '2026-08-05T12:00:00.000Z',
    status: 'OVERDUE',
    daysOverdue: 5,
    ...overrides,
  };
}

describe('contratos da Financial Intelligence Layer', () => {
  it('aceita somente o vocabulário previsto para categorias, fontes e cobertura', () => {
    expect(FINANCIAL_OBLIGATION_CATEGORIES).toEqual([
      'FIXED_ACCOUNT', 'LOAN', 'FINANCING', 'CARD_INSTALLMENT', 'SUPPLIER', 'CARD_STATEMENT',
    ]);
    expect(FINANCIAL_DATA_SOURCES).toEqual([
      'TRANSACTIONS', 'ACCOUNTS', 'FIXED_ACCOUNTS', 'FINANCIAL_CONTRACTS', 'CARDS',
    ]);
    expect(DATA_COVERAGE_STATUSES).toEqual(['AVAILABLE', 'NOT_IMPLEMENTED', 'UNAVAILABLE']);

    expectTypeOf<FinancialObligationCategory>().toEqualTypeOf<(typeof FINANCIAL_OBLIGATION_CATEGORIES)[number]>();
    expectTypeOf<FinancialDataSource>().toEqualTypeOf<(typeof FINANCIAL_DATA_SOURCES)[number]>();
    expectTypeOf<DataCoverageStatus>().toEqualTypeOf<(typeof DATA_COVERAGE_STATUSES)[number]>();
  });

  it('representa o FinancialStatusDTO completo com datas ISO e valores em reais', () => {
    const item = commitment();
    const status: FinancialStatusDTO = {
      referenceDate: REFERENCE_DATE,
      totalOverdue: 250.5,
      overdueCount: 1,
      categories: [{ type: 'FIXED_ACCOUNT', count: 1, total: 250.5, items: [item] }],
      upcomingCommitments: [],
      availableBalance: 17965,
      projectedBalance: 17714.5,
      projectionHorizonDays: 30,
      dataCoverage: buildFinancialDataCoverage({ FIXED_ACCOUNTS: 'AVAILABLE' }),
      generatedAt: '2026-08-10T15:30:01.000Z',
    };

    expect(status).toMatchObject({ totalOverdue: 250.5, availableBalance: 17965, projectedBalance: 17714.5 });
    expect(new Date(status.referenceDate).toISOString()).toBe(status.referenceDate);
    expect(new Date(status.generatedAt).toISOString()).toBe(status.generatedAt);
  });

  it('calcula dias civis de atraso usando a data de referência e nunca retorna negativo', () => {
    expect(calculateDaysOverdue('2026-08-05T23:59:59-03:00', REFERENCE_DATE)).toBe(5);
    expect(calculateDaysOverdue('2026-08-10T00:00:00.000Z', REFERENCE_DATE)).toBe(0);
    expect(calculateDaysOverdue('2026-08-12T00:00:00.000Z', REFERENCE_DATE)).toBe(0);
    expect(() => calculateDaysOverdue('data-inválida', REFERENCE_DATE)).toThrow(TypeError);
  });

  it('normaliza somente dados necessários e calcula daysOverdue apenas para vencidos', () => {
    expect(normalizeFinancialCommitment({
      id: 'loan-1',
      source: 'FINANCIAL_CONTRACTS',
      sourceType: 'LOAN',
      title: '  Empréstimo pessoal  ',
      amount: 1200,
      dueDate: '2026-08-01T00:00:00Z',
      status: 'OVERDUE',
    }, REFERENCE_DATE)).toEqual({
      id: 'loan-1',
      source: 'FINANCIAL_CONTRACTS',
      sourceType: 'LOAN',
      title: 'Empréstimo pessoal',
      amount: 1200,
      dueDate: '2026-08-01T00:00:00.000Z',
      status: 'OVERDUE',
      daysOverdue: 9,
    });

    expect(normalizeFinancialCommitment({
      id: 'financing-1',
      source: 'FINANCIAL_CONTRACTS',
      sourceType: 'FINANCING',
      title: 'Financiamento',
      amount: 900.25,
      dueDate: '2026-08-15T00:00:00.000Z',
      status: 'UPCOMING',
      daysOverdue: 99,
    }, REFERENCE_DATE)).not.toHaveProperty('daysOverdue');
  });

  it('agrupa somente vencidos por categoria e soma valores em reais sem conversão paralela', () => {
    const grouped = groupOverdueCommitments([
      commitment({ id: 'fixed-1', amount: 200 }),
      commitment({ id: 'fixed-2', amount: 150.75 }),
      commitment({ id: 'loan-1', source: 'FINANCIAL_CONTRACTS', sourceType: 'LOAN', amount: 3400 }),
      commitment({ id: 'future-1', sourceType: 'FINANCING', amount: 500, status: 'UPCOMING', daysOverdue: undefined }),
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({ type: 'FIXED_ACCOUNT', count: 2, total: 350.75 });
    expect(grouped[1]).toMatchObject({ type: 'LOAN', count: 1, total: 3400 });
    expect(grouped.flatMap((category) => category.items).map((item) => item.id)).not.toContain('future-1');
  });

  it('explicita dataCoverage para todas as fontes e mantém cartões como não implementados', () => {
    expect(buildFinancialDataCoverage({
      TRANSACTIONS: 'AVAILABLE',
      ACCOUNTS: 'AVAILABLE',
      FIXED_ACCOUNTS: 'AVAILABLE',
      FINANCIAL_CONTRACTS: 'UNAVAILABLE',
    })).toEqual([
      { source: 'TRANSACTIONS', status: 'AVAILABLE' },
      { source: 'ACCOUNTS', status: 'AVAILABLE' },
      { source: 'FIXED_ACCOUNTS', status: 'AVAILABLE' },
      { source: 'FINANCIAL_CONTRACTS', status: 'UNAVAILABLE' },
      { source: 'CARDS', status: 'NOT_IMPLEMENTED' },
    ]);
  });
});
