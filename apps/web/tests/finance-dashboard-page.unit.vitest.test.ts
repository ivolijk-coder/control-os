import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  FinanceDashboardView,
  type FinanceDashboardViewState,
} from '@/app/(dashboard)/financeiro/page';
import type { FinanceDashboardPayload } from '@/lib/finance';

function render(state: FinanceDashboardViewState): string {
  return renderToStaticMarkup(React.createElement(FinanceDashboardView, { state }));
}

function payload(overrides: Partial<FinanceDashboardPayload['dashboard']> = {}): FinanceDashboardPayload {
  return {
    dashboard: {
      currentBalance: 4000,
      monthIncome: 7000,
      monthExpenses: 3000,
      savings: 4000,
      topExpenseCategories: [{ category: 'Moradia', total: 1800 }],
      recentTransactions: [{
        id: 'transaction-1',
        type: 'despesa',
        description: 'Aluguel',
        amount: 1800,
        category: 'Moradia',
        date: '2030-01-10T12:00:00.000Z',
      }],
      monthlyEvolution: [
        { year: 2029, month: 12, totalIncome: 5000, totalExpenses: 2500, balance: 2500 },
        { year: 2030, month: 1, totalIncome: 7000, totalExpenses: 3000, balance: 4000 },
      ],
      ...overrides,
    },
    fixedAccounts: {
      overdue: [],
      dueToday: [],
      dueTomorrow: [],
      paidThisMonth: [],
      plannedThisMonth: [],
    },
  };
}

describe('dashboard financeiro real', () => {
  it('renderiza Skeleton durante o carregamento', () => {
    const html = render({ kind: 'loading' });
    expect(html).toContain('Carregando dashboard financeiro');
    expect(html).toContain('animate-shimmer');
  });

  it('renderiza o componente de erro existente', () => {
    const html = render({ kind: 'error', message: 'Dashboard indisponível.' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('Dashboard indisponível.');
  });

  it('renderiza EmptyState sem inventar valores quando o DTO está vazio', () => {
    const empty = payload({
      currentBalance: 0,
      monthIncome: 0,
      monthExpenses: 0,
      savings: 0,
      topExpenseCategories: [],
      recentTransactions: [],
      monthlyEvolution: [],
    });
    const html = render({ kind: 'success', data: empty });
    expect(html).toContain('Seu financeiro está pronto para começar.');
    expect(html).not.toContain('R$');
  });

  it('renderiza os quatro cards exclusivamente com os totais do DTO', () => {
    const html = render({ kind: 'success', data: payload() });
    expect(html).toContain('Receita');
    expect(html).toContain('Gastos');
    expect(html).toContain('Saldo');
    expect(html).toContain('Economia');
    expect(html).toContain('7.000');
    expect(html).toContain('3.000');
    expect(html).toContain('4.000');
  });

  it('serializa a resposta válida nos gráficos e lançamentos reais', () => {
    const html = render({ kind: 'success', data: payload() });
    expect(html).toContain('Evolução mensal');
    expect(html).toContain('Moradia');
    expect(html).toContain('1.800');
    expect(html).toContain('Aluguel');
    expect(html).toContain('Lançamentos recentes');
  });
});
