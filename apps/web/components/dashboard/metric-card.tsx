import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';
import type { DashboardStat } from '@control-os/types';

const ACCENT_CLASSES: Record<DashboardStat['accent'], string> = {
  green: 'text-accent-green',
  blue: 'text-accent-blue',
  purple: 'text-accent-purple',
  red: 'text-accent-red',
};

/**
 * MetricCard — substitui o antigo `StatCard` (Nova Experience — Fase 1).
 * Superfície de vidro interativa (`GlassCard`) com glow ambiente na cor do
 * acento e leve elevação no hover. Mesmos dados mockados de `MOCK_STATS`,
 * nenhuma lógica nova.
 */
export function MetricCard({ stat }: { stat: DashboardStat }) {
  const TrendIcon = stat.trend === 'down' ? ArrowDownRight : ArrowUpRight;

  return (
    <GlassCard glow={stat.accent} interactive className="p-5">
      <p className="text-xs font-medium text-text-secondary">{stat.label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-text-primary">{stat.value}</p>
      {stat.delta && (
        <div className={cn('mt-2 flex items-center gap-1 text-xs font-medium', ACCENT_CLASSES[stat.accent])}>
          <TrendIcon className="h-3 w-3" />
          <span>{stat.delta}</span>
        </div>
      )}
    </GlassCard>
  );
}
