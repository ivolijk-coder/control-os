import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FinancialDashboard } from '../financial-contract.types';

/** Testa só a formatação (seção 8 do script) — a agregação em si já é coberta por `financial-contract.service.unit.vitest.test.ts`. */

let dashboard: FinancialDashboard;
const getFinancialDashboard = vi.fn(async () => dashboard);

vi.mock('../financial-contract.service', () => ({ getFinancialDashboard }));

function emptyDashboard(): FinancialDashboard {
  return {
    outstandingBalance: { count: 0, total: 0 },
    dueThisMonth: { count: 0, total: 0 },
    paidThisMonth: { count: 0, total: 0 },
    pending: { count: 0, total: 0 },
    dueToday: [],
    dueThisWeek: [],
    overdue: [],
  };
}

describe('buildFinancialWeeklyReminder', () => {
  beforeEach(() => {
    dashboard = emptyDashboard();
    getFinancialDashboard.mockClear();
  });

  it('narra as parcelas vencendo essa semana no formato do script', async () => {
    dashboard.dueThisWeek = [
      { id: '1', contractId: 'c1', number: 24, amount: 6000, dueDate: '2026-08-24T00:00:00.000Z', status: 'PENDING', paidAt: null, paymentTransactionId: null, createdAt: '2026-08-01T00:00:00.000Z', contractName: 'Pronampe', contractInstitution: 'Santander' },
      { id: '2', contractId: 'c2', number: 3, amount: 3528, dueDate: '2026-08-17T00:00:00.000Z', status: 'PENDING', paidAt: null, paymentTransactionId: null, createdAt: '2026-08-01T00:00:00.000Z', contractName: 'Empréstimo', contractInstitution: 'Bradesco' },
      { id: '3', contractId: 'c3', number: 5, amount: 757, dueDate: '2026-08-20T00:00:00.000Z', status: 'PENDING', paidAt: null, paymentTransactionId: null, createdAt: '2026-08-01T00:00:00.000Z', contractName: 'Empréstimo', contractInstitution: 'Koin' },
    ];

    const { buildFinancialWeeklyReminder } = await import('../financial-reminder.service');
    const message = await buildFinancialWeeklyReminder('user-a');

    expect(message).toContain('Você tem 3 parcelas vencendo essa semana:');
    expect(message).toContain('Santander Pronampe: R$ 6.000,00 dia 24');
    expect(message).toContain('Bradesco Empréstimo: R$ 3.528,00 dia 17');
    expect(message).toContain('Koin Empréstimo: R$ 757,00 dia 20');
  });

  it('devolve undefined quando não há nada vencendo essa semana (a NOVA decide se cala)', async () => {
    const { buildFinancialWeeklyReminder } = await import('../financial-reminder.service');
    await expect(buildFinancialWeeklyReminder('user-a')).resolves.toBeUndefined();
  });
});

describe('buildFinancialOverdueReminder', () => {
  beforeEach(() => {
    dashboard = emptyDashboard();
    getFinancialDashboard.mockClear();
  });

  it('narra as parcelas atrasadas', async () => {
    dashboard.overdue = [{ id: '1', contractId: 'c1', number: 2, amount: 500, dueDate: '2026-07-20T00:00:00.000Z', status: 'OVERDUE', paidAt: null, paymentTransactionId: null, createdAt: '2026-07-01T00:00:00.000Z', contractName: 'Financiamento', contractInstitution: 'Itaú' }];

    const { buildFinancialOverdueReminder } = await import('../financial-reminder.service');
    const message = await buildFinancialOverdueReminder('user-a');

    expect(message).toContain('Você tem 1 parcela atrasada:');
    expect(message).toContain('Itaú Financiamento: R$ 500,00 dia 20');
  });
});
