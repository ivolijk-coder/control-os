'use client';

import { Badge } from '@control-os/ui';
import { FadeIn } from '@/components/dashboard/fade-in';
import { GlassCard } from '@/components/ui/glass-card';
import { useDataStore } from '@/lib/data-store';
import { formatCurrency } from '@/lib/utils';

function formatEntryDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(date));
}

/**
 * Financeiro — módulo completo (CONTROL OS 3.0).
 *
 * Lê de `useDataStore`: todo lançamento criado por conversa com a Nova
 * (ex.: "Gastei R$ 35 no almoço", "Recebi R$ 2.500") aparece aqui
 * automaticamente — fonte única de dados com o Dashboard e o Painel
 * Inteligente.
 */
export default function FinanceiroPage() {
  const financeEntries = useDataStore((state) => state.financeEntries);

  const receitaTotal = financeEntries
    .filter((entry) => entry.type === 'receita')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const gastosTotal = financeEntries
    .filter((entry) => entry.type === 'despesa')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const saldo = receitaTotal - gastosTotal;

  const sortedEntries = [...financeEntries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <h1 className="text-lg font-semibold text-text-primary">Financeiro</h1>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <GlassCard interactive={false} glow="blue" className="p-5">
            <p className="text-xs text-text-tertiary">Receita</p>
            <p className="mt-1 text-xl font-semibold text-text-primary">{formatCurrency(receitaTotal)}</p>
          </GlassCard>
          <GlassCard interactive={false} glow="red" className="p-5">
            <p className="text-xs text-text-tertiary">Gastos</p>
            <p className="mt-1 text-xl font-semibold text-text-primary">{formatCurrency(gastosTotal)}</p>
          </GlassCard>
          <GlassCard interactive={false} glow={saldo >= 0 ? 'green' : 'red'} className="p-5">
            <p className="text-xs text-text-tertiary">Saldo</p>
            <p className="mt-1 text-xl font-semibold text-text-primary">{formatCurrency(saldo)}</p>
          </GlassCard>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-text-primary">Lançamentos</h2>

          {sortedEntries.length === 0 && (
            <GlassCard interactive={false} className="p-8 text-center text-sm text-text-secondary">
              Nenhum lançamento ainda. Conte para a Nova o que você gastou ou recebeu.
            </GlassCard>
          )}

          <div className="flex flex-col gap-2">
            {sortedEntries.map((entry) => (
              <GlassCard key={entry.id} interactive={false} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 flex-col">
                    <p className="truncate text-sm text-text-primary">{entry.description}</p>
                    <p className="text-xs text-text-tertiary">
                      {entry.category} · {formatEntryDate(entry.date)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={entry.type === 'receita' ? 'green' : 'red'}>
                      {entry.type === 'receita' ? 'Receita' : 'Despesa'}
                    </Badge>
                    <span
                      className={
                        entry.type === 'receita'
                          ? 'font-mono text-sm text-accent-green'
                          : 'font-mono text-sm text-accent-red'
                      }
                    >
                      {entry.type === 'receita' ? '+' : '-'}
                      {formatCurrency(entry.amount)}
                    </span>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
