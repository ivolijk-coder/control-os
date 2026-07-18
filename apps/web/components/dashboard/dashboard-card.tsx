import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';

const ACCENT_TEXT: Record<'green' | 'blue' | 'purple' | 'red', string> = {
  green: 'text-accent-green',
  blue: 'text-accent-blue',
  purple: 'text-accent-purple',
  red: 'text-accent-red',
};

export interface DashboardCardProps {
  icon?: LucideIcon;
  label: string;
  value: string;
  delta?: string;
  trend?: 'up' | 'down' | 'neutral';
  accent?: 'green' | 'blue' | 'purple' | 'red';
  /** Ativa o glow ambiente do `GlassCard`. Padrão: false — reservado para o único cartão que de fato precisa chamar atenção numa tela (CONTROL OS — Etapa 12B). */
  highlight?: boolean;
  className?: string;
}

/**
 * DashboardCard — cartão de estatística genérico (CONTROL OS — Etapa 10B).
 *
 * Generaliza o padrão que já existia repetido à mão em Financeiro
 * (Receita/Gastos/Saldo/Dívidas) e Patrimônio (Valor total) — mesmo
 * `GlassCard` com glow, só que como componente único em vez de markup
 * copiado. `MetricCard` (`components/dashboard/metric-card.tsx`) continua
 * existindo para o caso específico que já usa — este cobre o caso genérico
 * usado pelos módulos.
 *
 * CONTROL OS — Etapa 12B: Premium Experience Polish, "Cores": antes todo
 * `DashboardCard` acendia o glow ambiente do `GlassCard` por padrão — numa
 * grade de 4 (Financeiro: Receita/Gastos/Saldo/Dívidas) isso significava 4
 * manchas coloridas disputando atenção na mesma tela ao mesmo tempo, o
 * oposto de "apenas elementos realmente importantes devem chamar atenção".
 * O glow virou opt-in (`highlight`); o significado da cor continua
 * totalmente preservado no ícone e no texto (`ACCENT_TEXT`) — só a mancha
 * de fundo decorativa saiu do caminho por padrão.
 */
export function DashboardCard({
  icon: Icon,
  label,
  value,
  delta,
  trend,
  accent = 'purple',
  highlight = false,
  className,
}: DashboardCardProps) {
  const TrendIcon = trend === 'down' ? ArrowDownRight : ArrowUpRight;

  return (
    <GlassCard interactive glow={highlight ? accent : 'none'} className={cn('p-5', className)}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className={cn('h-3.5 w-3.5', ACCENT_TEXT[accent])} />}
        <p className="text-xs font-medium text-text-secondary">{label}</p>
      </div>
      <p className="mt-2 font-mono text-xl font-semibold tracking-tight text-text-primary">{value}</p>
      {delta && (
        <div className={cn('mt-2 flex items-center gap-1 text-xs font-medium', ACCENT_TEXT[accent])}>
          {trend && trend !== 'neutral' && <TrendIcon className="h-3 w-3" />}
          <span>{delta}</span>
        </div>
      )}
    </GlassCard>
  );
}
