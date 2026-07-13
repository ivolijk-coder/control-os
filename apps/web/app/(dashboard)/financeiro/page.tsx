'use client';

import { CreditCard, Repeat, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Button } from '@control-os/ui';
import { FadeIn } from '@/components/dashboard/fade-in';
import { GlassCard } from '@/components/ui/glass-card';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/dashboard/section-header';
import { DashboardCard } from '@/components/dashboard/dashboard-card';
import { ChartCard } from '@/components/dashboard/chart-card';
import { MiniBarChart, MiniSparkline } from '@/components/dashboard/mini-charts';
import { RecommendationCard } from '@/components/dashboard/recommendation-card';
import { ProgressRing } from '@/components/dashboard/progress-ring';
import { useDataStore } from '@/lib/data-store';
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

function categoryEmoji(category: string): string {
  return CATEGORY_EMOJI[category] ?? '💳';
}

function formatEntryDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(date));
}

const CHART_ACCENTS = ['purple', 'blue', 'green', 'red'] as const;

/**
 * Financeiro — módulo premium (CONTROL OS — Etapa 10B).
 *
 * Lê de `useDataStore` exatamente como antes — nenhum campo novo, nenhuma
 * chamada nova. A diferença é só de apresentação: em vez de duas listas
 * ("Dívidas", "Lançamentos") em sequência, agora tem fluxo do mês, gastos
 * por categoria e um resumo derivado (não é IA ao vivo — é cálculo local
 * puro sobre os mesmos lançamentos, igual ao `buildHomeInsights` da Etapa 9).
 * "Assinaturas" é uma leitura filtrada dos mesmos `financeEntries`
 * (categoria "Software" ou descrição contendo "assinatura") — não é um tipo
 * de dado novo. "Parcelamentos" é a mesma lista de `debts` de sempre, só
 * com um anel de progresso no lugar da barra linear.
 */
export default function FinanceiroPage() {
  const financeEntries = useDataStore((state) => state.financeEntries);
  const debts = useDataStore((state) => state.debts);
  const payDebtInstallment = useDataStore((state) => state.payDebtInstallment);

  const receitaTotal = financeEntries
    .filter((entry) => entry.type === 'receita')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const gastosTotal = financeEntries
    .filter((entry) => entry.type === 'despesa')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const saldo = receitaTotal - gastosTotal;
  const dividasTotal = debts.reduce((sum, debt) => sum + debt.remainingAmount, 0);

  const sortedEntries = [...financeEntries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Fluxo do mês: saldo acumulado ao longo dos lançamentos, do mais antigo
  // pro mais recente — só os lançamentos que já existem, nada projetado.
  const chronological = [...financeEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const flowValues = chronological.reduce<number[]>((acc, entry) => {
    const previous = acc.length > 0 ? acc[acc.length - 1] ?? 0 : 0;
    const delta = entry.type === 'receita' ? entry.amount : -entry.amount;
    acc.push(previous + delta);
    return acc;
  }, []);

  // Gastos por categoria — só despesas, agrupadas e ordenadas da maior pra menor.
  const gastosPorCategoria = Array.from(
    financeEntries
      .filter((entry) => entry.type === 'despesa')
      .reduce((map, entry) => {
        map.set(entry.category, (map.get(entry.category) ?? 0) + entry.amount);
        return map;
      }, new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .map(([category, value], index) => ({
      label: `${categoryEmoji(category)} ${category}`,
      value,
      displayValue: formatCurrency(value),
      accent: CHART_ACCENTS[index % CHART_ACCENTS.length],
    }));

  const assinaturas = financeEntries.filter(
    (entry) => entry.category === 'Software' || entry.description.toLowerCase().includes('assinatura')
  );

  const maiorCategoria = gastosPorCategoria[0];
  const resumoNova =
    maiorCategoria && gastosTotal > 0
      ? `${Math.round((maiorCategoria.value / gastosTotal) * 100)}% dos seus gastos este mês foram em ${maiorCategoria.label.replace(/^\S+\s/, '')}. Saldo atual: ${formatCurrency(saldo)}.`
      : 'Ainda não há gastos suficientes este mês para eu montar um resumo.';

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <SectionHeader level="page" title="Financeiro" meta={`${financeEntries.length} lançamentos`} />
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardCard icon={TrendingUp} label="Receita" value={formatCurrency(receitaTotal)} accent="blue" />
          <DashboardCard icon={TrendingDown} label="Gastos" value={formatCurrency(gastosTotal)} accent="red" />
          <DashboardCard icon={Wallet} label="Saldo" value={formatCurrency(saldo)} accent={saldo >= 0 ? 'green' : 'red'} />
          <DashboardCard
            icon={CreditCard}
            label="Dívidas em aberto"
            value={formatCurrency(dividasTotal)}
            accent={dividasTotal > 0 ? 'red' : 'green'}
          />
        </div>
      </FadeIn>

      <FadeIn delay={0.08}>
        <RecommendationCard text={resumoNova} />
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Fluxo do mês" description="Saldo acumulado ao longo dos lançamentos">
            <MiniSparkline values={flowValues} accent={saldo >= 0 ? 'green' : 'red'} />
          </ChartCard>
          <ChartCard title="Gastos por categoria">
            {gastosPorCategoria.length > 0 ? (
              <MiniBarChart data={gastosPorCategoria} />
            ) : (
              <p className="text-xs text-text-tertiary">Nenhuma despesa registrada ainda.</p>
            )}
          </ChartCard>
        </div>
      </FadeIn>

      <FadeIn delay={0.13}>
        <div className="flex flex-col gap-3">
          <SectionHeader title="Parcelamentos" meta={`${debts.length} em aberto`} />

          {debts.length === 0 && (
            <EmptyState
              icon={CreditCard}
              title="Nenhuma dívida registrada."
              description='Conte para a Nova, ex.: "Tenho uma dívida de R$ 3.000 em 10x".'
            />
          )}

          <div className="flex flex-col gap-2">
            {debts.map((debt) => {
              const quitada = debt.remainingAmount <= 0;
              const progress = (debt.installmentsPaid / debt.installmentsTotal) * 100;
              return (
                <GlassCard key={debt.id} interactive={false} className="p-4">
                  <div className="flex items-center gap-4">
                    <ProgressRing value={progress} size={44} strokeWidth={4} accent={quitada ? 'green' : 'purple'}>
                      <span className="font-mono text-[10px] text-text-secondary">{Math.round(progress)}%</span>
                    </ProgressRing>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p className="truncate text-sm text-text-primary">{debt.description}</p>
                      <p className="text-xs text-text-tertiary">
                        {debt.category} · {debt.installmentsPaid}/{debt.installmentsTotal} parcelas
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-mono text-sm text-accent-red">{formatCurrency(debt.remainingAmount)}</span>
                      <Button variant="secondary" size="sm" disabled={quitada} onClick={() => payDebtInstallment(debt.id)}>
                        {quitada ? 'Quitada' : 'Pagar parcela'}
                      </Button>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </div>
      </FadeIn>

      {assinaturas.length > 0 && (
        <FadeIn delay={0.16}>
          <div className="flex flex-col gap-3">
            <SectionHeader title="Assinaturas" meta={`${assinaturas.length}`} />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {assinaturas.map((entry) => (
                <GlassCard key={entry.id} interactive={false} className="flex items-center gap-3 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.06]">
                    <Repeat className="h-4 w-4 text-text-secondary" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate text-sm text-text-primary">{entry.description}</p>
                    <p className="text-xs text-text-tertiary">{formatEntryDate(entry.date)}</p>
                  </div>
                  <span className="shrink-0 font-mono text-sm text-accent-red">{formatCurrency(entry.amount)}</span>
                </GlassCard>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      <FadeIn delay={0.18}>
        <div className="flex flex-col gap-3">
          <SectionHeader title="Lançamentos" meta={`${sortedEntries.length}`} />

          {sortedEntries.length === 0 && (
            <EmptyState title="Nenhum lançamento ainda." description="Conte para a Nova o que você gastou ou recebeu." />
          )}

          <div className="flex flex-col gap-2">
            {sortedEntries.map((entry) => (
              <GlassCard key={entry.id} interactive={false} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 flex-col">
                    <p className="truncate text-sm text-text-primary">{entry.description}</p>
                    <p className="text-xs text-text-tertiary">
                      {categoryEmoji(entry.category)} {entry.category} · {formatEntryDate(entry.date)}
                    </p>
                  </div>
                  <span
                    className={
                      entry.type === 'receita'
                        ? 'shrink-0 font-mono text-sm text-accent-green'
                        : 'shrink-0 font-mono text-sm text-accent-red'
                    }
                  >
                    {entry.type === 'receita' ? '+' : '-'}
                    {formatCurrency(entry.amount)}
                  </span>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
