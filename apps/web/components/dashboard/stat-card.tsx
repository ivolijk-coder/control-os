import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card } from '@control-os/ui';
import { cn } from '@/lib/utils';
import type { DashboardStat } from '@control-os/types';

const ACCENT_CLASSES: Record<DashboardStat['accent'], string> = {
  green: 'text-accent-green',
  blue: 'text-accent-blue',
  purple: 'text-accent-purple',
  red: 'text-accent-red',
};

const ACCENT_GLOW: Record<DashboardStat['accent'], string> = {
  green: 'from-accent-green/10',
  blue: 'from-accent-blue/10',
  purple: 'from-accent-purple/10',
  red: 'from-accent-red/10',
};

export function StatCard({ stat }: { stat: DashboardStat }) {
  const TrendIcon = stat.trend === 'down' ? ArrowDownRight : ArrowUpRight;

  return (
    <Card className="relative overflow-hidden p-5">
      <div
        className={cn('pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br to-transparent blur-2xl', ACCENT_GLOW[stat.accent])}
      />
      <p className="text-xs font-medium text-text-secondary">{stat.label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-text-primary">{stat.value}</p>
      {stat.delta && (
        <div className={cn('mt-2 flex items-center gap-1 text-xs font-medium', ACCENT_CLASSES[stat.accent])}>
          <TrendIcon className="h-3 w-3" />
          <span>{stat.delta}</span>
        </div>
      )}
    </Card>
  );
}
