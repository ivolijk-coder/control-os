'use client';

import * as React from 'react';
import { CreditCard, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { FadeIn } from '@/components/dashboard/fade-in';
import { GlassCard } from '@/components/ui/glass-card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormError } from '@/components/ui/form-error';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionHeader } from '@/components/dashboard/section-header';
import { DashboardCard } from '@/components/dashboard/dashboard-card';
import { ChartCard } from '@/components/dashboard/chart-card';
import { MiniBarChart, MiniSparkline } from '@/components/dashboard/mini-charts';
import { RecommendationCard } from '@/components/dashboard/recommendation-card';
import {
  useFinanceDashboard,
  type FinanceDashboardPayload,
} from '@/lib/finance';
import { formatCurrency } from '@/lib/utils';

const CATEGORY_EMOJI: Record<string, string> = {
  Alimentação: '🍽️',
  Software: '💻',
  Serviços: '🧾',
  Transporte: '🚗',
  Lazer: '🎬',
  Saúde: '💊',
  Educação: '📚',
  Moradia: '🏠',
};

const CHART_ACCENTS = ['purple', 'blue', 'green', 'red'] as const;

export type FinanceDashboardViewState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; data: FinanceDashboardPayload };

function categoryEmoji(category: string): string {
  return CATEGORY_EMOJI[category] ?? '💳';
}

function formatEntryDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(date));
}

function hasDashboardData(data: FinanceDashboardPayload): boolean {
  const { dashboard, fixedAccounts } = data;
  return dashboard.currentBalance !== 0
    || dashboard.monthIncome !== 0
    || dashboard.monthExpenses !== 0
    || dashboard.savings !== 0
    || dashboard.recentTransactions.length > 0
    || dashboard.topExpenseCategories.length > 0
    || dashboard.monthlyEvolution.length > 0
    || fixedAccounts.plannedThisMonth.length > 0;
}

function entryIsPositive(entry: FinanceDashboardPayload['dashboard']['recentTransactions'][number]): boolean {
  return entry.type === 'receita'
    || (entry.type === 'transferencia' && entry.transferDirection === 'entrada');
}

export default function FinanceiroPage() {
  const dashboardQuery = useFinanceDashboard();

  if (dashboardQuery.isPending) {
    return <FinanceDashboardView state={{ kind: 'loading' }} />;
  }
  if (dashboardQuery.isError) {
    return (
      <FinanceDashboardView
        state={{
          kind: 'error',
          message: dashboardQuery.error.message || 'Não foi possível carregar o dashboard financeiro.',
        }}
      />
    );
  }
  return <FinanceDashboardView state={{ kind: 'success', data: dashboardQuery.data }} />;
}

export function FinanceDashboardView({ state }: { state: FinanceDashboardViewState }) {
  if (state.kind === 'loading') return <FinanceDashboardLoading />;

  if (state.kind === 'error') {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <SectionHeader level="page" title="Financeiro" />
        <FormError message={state.message} />
      </div>
    );
  }

  if (!hasDashboardData(state.data)) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <SectionHeader level="page" title="Financeiro" meta="0 lançamentos" />
        <EmptyState
          icon={Wallet}
          title="Seu financeiro está pronto para começar."
          description="Registre uma receita ou despesa para acompanhar seus dados reais aqui."
        />
      </div>
    );
  }

  const { dashboard, fixedAccounts } = state.data;
  const categoryChart = dashboard.topExpenseCategories.map((item, index) => ({
    label: `${categoryEmoji(item.category)} ${item.category}`,
    value: item.total,
    displayValue: formatCurrency(item.total),
    accent: CHART_ACCENTS[index % CHART_ACCENTS.length],
  }));
  const flowValues = dashboard.monthlyEvolution.map((point) => point.balance);
  const topCategory = dashboard.topExpenseCategories[0];
  const summary = topCategory
    ? `Sua maior categoria de gastos no período é ${topCategory.category}, com ${formatCurrency(topCategory.total)}. Saldo atual: ${formatCurrency(dashboard.currentBalance)}.`
    : `Receitas de ${formatCurrency(dashboard.monthIncome)}, despesas de ${formatCurrency(dashboard.monthExpenses)} e saldo atual de ${formatCurrency(dashboard.currentBalance)}.`;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <SectionHeader level="page" title="Financeiro" meta={`${dashboard.recentTransactions.length} lançamentos recentes`} />
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardCard icon={TrendingUp} label="Receita" value={formatCurrency(dashboard.monthIncome)} accent="blue" />
          <DashboardCard icon={TrendingDown} label="Gastos" value={formatCurrency(dashboard.monthExpenses)} accent="red" />
          <DashboardCard
            icon={Wallet}
            label="Saldo"
            value={formatCurrency(dashboard.currentBalance)}
            accent={dashboard.currentBalance >= 0 ? 'green' : 'red'}
          />
          <DashboardCard
            icon={CreditCard}
            label="Economia"
            value={formatCurrency(dashboard.savings)}
            accent={dashboard.savings >= 0 ? 'green' : 'red'}
          />
        </div>
      </FadeIn>

      <FadeIn delay={0.08}>
        <RecommendationCard text={summary} />
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Evolução mensal" description="Saldo consolidado informado pelo financeiro">
            <MiniSparkline values={flowValues} accent={dashboard.currentBalance >= 0 ? 'green' : 'red'} />
          </ChartCard>
          <ChartCard title="Gastos por categoria">
            {categoryChart.length > 0 ? (
              <MiniBarChart data={categoryChart} />
            ) : (
              <p className="text-xs text-text-tertiary">Nenhuma despesa registrada no período.</p>
            )}
          </ChartCard>
        </div>
      </FadeIn>

      <FadeIn delay={0.13}>
        <div className="flex flex-col gap-3">
          <SectionHeader title="Compromissos do mês" meta={`${fixedAccounts.plannedThisMonth.length}`} />
          {fixedAccounts.plannedThisMonth.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="Nenhum compromisso previsto neste mês."
              description="Contas fixas materializadas aparecerão aqui."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {fixedAccounts.plannedThisMonth.map((occurrence) => (
                <GlassCard key={occurrence.id} interactive={false} className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 flex-col">
                      <p className="truncate text-sm text-text-primary">{occurrence.name}</p>
                      <p className="text-xs text-text-tertiary">
                        {formatEntryDate(occurrence.dueDate)} · {occurrence.displayStatus}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm text-text-primary">
                      {formatCurrency(occurrence.amount)}
                    </span>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      </FadeIn>

      <FadeIn delay={0.18}>
        <div className="flex flex-col gap-3">
          <SectionHeader title="Lançamentos recentes" meta={`${dashboard.recentTransactions.length}`} />
          {dashboard.recentTransactions.length === 0 ? (
            <EmptyState title="Nenhum lançamento recente." description="Seus próximos lançamentos aparecerão aqui." />
          ) : (
            <div className="flex flex-col gap-2">
              {dashboard.recentTransactions.map((entry) => {
                const positive = entryIsPositive(entry);
                return (
                  <GlassCard key={entry.id} interactive={false} className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 flex-col">
                        <p className="truncate text-sm text-text-primary">{entry.description}</p>
                        <p className="text-xs text-text-tertiary">
                          {categoryEmoji(entry.category)} {entry.category} · {formatEntryDate(entry.date)}
                        </p>
                      </div>
                      <span className={positive
                        ? 'shrink-0 font-mono text-sm text-accent-green'
                        : 'shrink-0 font-mono text-sm text-accent-red'}
                      >
                        {positive ? '+' : '-'}
                        {formatCurrency(entry.amount)}
                      </span>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      </FadeIn>
    </div>
  );
}

function FinanceDashboardLoading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8" aria-label="Carregando dashboard financeiro">
      <Skeleton className="h-10 w-56" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-28" />)}
      </div>
      <Skeleton className="h-16" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-36" />
    </div>
  );
}
