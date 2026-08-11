import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TimelineCardItem {
  id: string;
  icon: LucideIcon;
  title: string;
  meta?: string;
  done?: boolean;
  accent?: 'purple' | 'blue' | 'green' | 'red';
}

const ACCENT_WRAP: Record<'purple' | 'blue' | 'green' | 'red', string> = {
  purple: 'bg-accent-purple/15 text-accent-purple',
  blue: 'bg-accent-blue/15 text-accent-blue',
  green: 'bg-accent-green/15 text-accent-green',
  red: 'bg-accent-red/15 text-accent-red',
};

/**
 * TimelineCard — linha do tempo vertical genérica (CONTROL OS — Etapa 10B).
 *
 * Generaliza o padrão de `TimelineFeed` (que fica específico de
 * `TimelineEvent`, usado pelo Dashboard/Empresa, fora de escopo) para
 * qualquer lista com ordem temporal — usado em Agenda (compromissos) e
 * Viagens (linha do tempo da viagem).
 */
export function TimelineCard({ items }: { items: TimelineCardItem[] }) {
  return (
    <ol className="flex flex-col gap-1">
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <li key={item.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  item.accent ? ACCENT_WRAP[item.accent] : 'bg-tint/[0.06] text-text-secondary'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              {index < items.length - 1 && <span className="my-1 h-full w-px flex-1 bg-tint/[0.08]" />}
            </div>
            <div className="min-w-0 flex-1 pb-5">
              <p className={cn('text-sm leading-snug text-text-primary', item.done && 'text-text-tertiary line-through')}>
                {item.title}
              </p>
              {item.meta && <p className="mt-0.5 text-xs text-text-tertiary">{item.meta}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
