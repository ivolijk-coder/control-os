import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACCENT_ICON_WRAP: Record<'purple' | 'blue' | 'green' | 'red', string> = {
  purple: 'bg-accent-purple/15 text-accent-purple',
  blue: 'bg-accent-blue/15 text-accent-blue',
  green: 'bg-accent-green/15 text-accent-green',
  red: 'bg-accent-red/15 text-accent-red',
};

export interface InsightCardProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  accent?: 'purple' | 'blue' | 'green' | 'red';
  className?: string;
}

/**
 * InsightCard — cartão compacto para um único insight/alerta (CONTROL OS —
 * Etapa 10B). Usado na Home (resumo do dia em cards, no lugar de bullets de
 * texto) e nos módulos, para destacar uma observação pontual (ex.: "Ainda
 * faltam 2 hábitos hoje", "Vence em 90 dias"). Puramente apresentacional —
 * quem chama decide o texto a partir de dado já existente.
 */
export function InsightCard({ icon: Icon, title, description, accent = 'purple', className }: InsightCardProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-tint/[0.08] bg-tint/[0.03] p-3.5 text-left backdrop-blur-sm',
        className
      )}
    >
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', ACCENT_ICON_WRAP[accent])}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm leading-snug text-text-primary">{title}</p>
        {description && <p className="text-xs leading-snug text-text-tertiary">{description}</p>}
      </div>
    </div>
  );
}
