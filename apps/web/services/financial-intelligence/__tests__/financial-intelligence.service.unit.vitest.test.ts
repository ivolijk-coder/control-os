import type { FixedAccountOccurrence } from '@control-os/types';
import type { FinancialContract, FinancialInstallment } from '@/services/finance-contracts';
import { describe, expect, it, vi } from 'vitest';
import { DefaultFinancialIntelligenceService } from '../financial-intelligence.service';
import type { FinancialIntelligenceSources } from '../financial-intelligence.sources';

const USER_ID = 'user-owner';
const REFERENCE_DATE = '2026-08-10T12:00:00.000Z';

function fixedOccurrence(overrides: Partial<FixedAccountOccurrence> = {}): FixedAccountOccurrence {
  return {
    id: 'fixed-occurrence-1',
    fixedAccountId: 'fixed-account-1',
    competenceMonth: 8,
    competenceYear: 2026,
    referencePeriod: '2026-08',
    dueDate: '2026-08-05T00:00:00.000Z',
    name: 'Condomínio',
    type: 'despesa',
    origin: 'pessoal',
    categoryId: 'category-1',
    paymentMethod: 'boleto',
    amount: 300,
    status: 'pendente',
    displayStatus: 'atrasada',
    paidAmount: 0,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function installment(overrides: Partial<FinancialInstallment> = {}): FinancialInstallment {
  return {
    id: 'installment-1',
    contractId: 'contract-1',
    number: 1,
    amount: 1000,
    dueDate: '2026-08-03T00:00:00.000Z',
    status: 'PENDING',
    paidAt: null,
    paymentTransactionId: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function contract(overrides: Partial<FinancialContract> = {}): FinancialContract {
  const baseInstallment = installment();
  return {
    id: 'contract-1',
    userId: USER_ID,
    name: 'Crédito pessoal',
    institution: 'Banco Exemplo',
    type: 'LOAN',
    origin: 'PERSONAL',
    categoryId: null,
    accountId: null,
    totalAmount: 12000,
    financedAmount: 12000,
    installmentAmount: 1000,
    totalInstallments: 12,
    paidInstallments: 0,
    dueDay: 3,
    startDate: '2026-08-03T00:00:00.000Z',
    endDate: null,
    interestRate: null,
    status: 'ACTIVE',
    source: 'MANUAL',
    documentId: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    installments: [{ ...baseInstallment, contractId: 'contract-1' }],
    ...overrides,
  };
}

function setup(options: {
  balance?: number;
  fixed?: FixedAccountOccurrence[];
  contracts?: FinancialContract[];
  fail?: 'balance' | 'fixed' | 'contracts';
} = {}) {
  const sources: FinancialIntelligenceSources = {
    getAvailableBalance: vi.fn(async () => {
      if (options.fail === 'balance') throw new Error('balance unavailable');
      return options.balance ?? 5000;
    }),
    listFixedAccountOccurrences: vi.fn(async () => {
      if (options.fail === 'fixed') throw new Error('fixed unavailable');
      return options.fixed ?? [];
    }),
    listFinancialContracts: vi.fn(async () => {
      if (options.fail === 'contracts') throw new Error('contracts unavailable');
      return options.contracts ?? [];
    }),
  };
  const service = new DefaultFinancialIntelligenceService(sources, () => new Date('2026-08-10T13:00:00.000Z'));
  return { service, sources };
}

describe('DefaultFinancialIntelligenceService', () => {
  it('consolida somente contas fixas atrasadas pelo vencimento real', async () => {
    const { service } = setup({ fixed: [fixedOccurrence({ status: 'pendente', displayStatus: 'pendente' })] });
    const result = await service.getStatus(USER_ID, { referenceDate: REFERENCE_DATE });

    expect(result).toMatchObject({ totalOverdue: 300, overdueCount: 1, availableBalance: 5000 });
    expect(result.categories[0]).toMatchObject({ type: 'FIXED_ACCOUNT', count: 1, total: 300 });
    expect(result.categories[0]?.items[0]).toMatchObject({ status: 'OVERDUE', daysOverdue: 5 });
  });

  it('consolida somente contratos atrasados mesmo quando a parcela ainda está PENDING', async () => {
    const { service } = setup({ contracts: [contract()] });
    const result = await service.getStatus(USER_ID, { referenceDate: REFERENCE_DATE });

    expect(result).toMatchObject({ totalOverdue: 1000, overdueCount: 1 });
    expect(result.categories[0]).toMatchObject({ type: 'LOAN', total: 1000 });
    expect(result.categories[0]?.items[0]).toMatchObject({ source: 'FINANCIAL_CONTRACTS', status: 'OVERDUE' });
  });

  it('agrega contas fixas e contratos sem dupla contagem', async () => {
    const { service } = setup({ fixed: [fixedOccurrence()], contracts: [contract()] });
    const result = await service.getStatus(USER_ID, { referenceDate: REFERENCE_DATE });

    expect(result.totalOverdue).toBe(1300);
    expect(result.overdueCount).toBe(2);
    expect(result.categories.map((category) => category.type)).toEqual(['FIXED_ACCOUNT', 'LOAN']);
  });

  it('exclui parcelas pagas e canceladas', async () => {
    const paid = installment({ id: 'paid', status: 'PAID', paidAt: '2026-08-04T00:00:00.000Z' });
    const cancelled = installment({ id: 'cancelled', status: 'CANCELLED' });
    const { service } = setup({ contracts: [contract({ installments: [paid, cancelled] })] });

    await expect(service.getStatus(USER_ID, { referenceDate: REFERENCE_DATE })).resolves.toMatchObject({
      totalOverdue: 0,
      overdueCount: 0,
      categories: [],
    });
  });

  it('exclui contas pagas, canceladas e parciais sem saldo restante', async () => {
    const { service } = setup({ fixed: [
      fixedOccurrence({ id: 'paid', status: 'paga' }),
      fixedOccurrence({ id: 'cancelled', status: 'cancelada' }),
      fixedOccurrence({ id: 'fully-partial', status: 'parcial', paidAmount: 300 }),
    ] });

    await expect(service.getStatus(USER_ID, { referenceDate: REFERENCE_DATE })).resolves.toMatchObject({
      totalOverdue: 0,
      overdueCount: 0,
    });
  });

  it('repassa o userId para todas as fontes e nunca aceita identidade de outro lugar', async () => {
    const { service, sources } = setup();
    await service.getStatus(USER_ID, { referenceDate: REFERENCE_DATE });

    expect(sources.getAvailableBalance).toHaveBeenCalledWith(USER_ID);
    expect(sources.listFixedAccountOccurrences).toHaveBeenCalledWith(USER_ID);
    expect(sources.listFinancialContracts).toHaveBeenCalledWith(USER_ID);
  });

  it('marca uma fonte com falha como UNAVAILABLE e não inventa saldo projetado', async () => {
    const { service } = setup({ fixed: [fixedOccurrence()], fail: 'contracts' });
    const result = await service.getStatus(USER_ID, { referenceDate: REFERENCE_DATE });

    expect(result.totalOverdue).toBe(300);
    expect(result.projectedBalance).toBeNull();
    expect(result.dataCoverage).toContainEqual({ source: 'FINANCIAL_CONTRACTS', status: 'UNAVAILABLE' });
    expect(result.dataCoverage).toContainEqual({ source: 'FIXED_ACCOUNTS', status: 'AVAILABLE' });
    expect(result.dataCoverage).toContainEqual({ source: 'CARDS', status: 'NOT_IMPLEMENTED' });
  });

  it('usa a data de referência informada em vez do relógio atual', async () => {
    const { service } = setup({ contracts: [contract({
      installments: [installment({ dueDate: '2026-09-01T00:00:00.000Z' })],
    })] });

    const beforeDueDate = await service.getStatus(USER_ID, { referenceDate: '2026-08-20T00:00:00.000Z' });
    const afterDueDate = await service.getStatus(USER_ID, { referenceDate: '2026-09-05T00:00:00.000Z' });

    expect(beforeDueDate.overdueCount).toBe(0);
    expect(beforeDueDate.upcomingCommitments).toHaveLength(1);
    expect(afterDueDate.overdueCount).toBe(1);
    expect(afterDueDate.categories[0]?.items[0]?.daysOverdue).toBe(4);
  });
});
