'use client';

import { Check } from 'lucide-react';
import { FadeIn } from '@/components/dashboard/fade-in';
import { GlassCard } from '@/components/ui/glass-card';
import { ICON_MAP } from '@/components/layout/icon-map';
import { useDataStore } from '@/lib/data-store';
import { cn, formatCurrency } from '@/lib/utils';

function formatRange(start: string, end: string): string {
  const format = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
  return `${format.format(new Date(start))} – ${format.format(new Date(end))}`;
}

/**
 * Viagens — módulo pessoal (CONTROL OS — Sistema Operacional Pessoal).
 *
 * Cada viagem tem seu próprio checklist (`Trip.checklist`) — clicável
 * direto na tela (`toggleTripChecklistItem`), sem precisar passar pela
 * Nova pra marcar um item como feito.
 */
export default function ViagensPage() {
  const trips = useDataStore((state) => state.trips);
  const toggleTripChecklistItem = useDataStore((state) => state.toggleTripChecklistItem);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text-primary">Viagens</h1>
          <span className="text-xs text-text-tertiary">{trips.length} planejadas</span>
        </div>
      </FadeIn>

      {trips.length === 0 && (
        <FadeIn delay={0.05}>
          <GlassCard interactive={false} className="p-8 text-center text-sm text-text-secondary">
            Nenhuma viagem planejada ainda.
          </GlassCard>
        </FadeIn>
      )}

      <div className="flex flex-col gap-4">
        {trips.map((trip, index) => {
          const done = trip.checklist.filter((item) => item.done).length;
          return (
            <FadeIn key={trip.id} delay={0.05 * (index + 1)}>
              <GlassCard interactive={false} className="p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-text-secondary">
                    <ICON_MAP.Plane className="h-4 w-4" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="text-sm font-medium text-text-primary">{trip.destination}</p>
                    <p className="text-xs text-text-tertiary">
                      {formatRange(trip.startDate, trip.endDate)}
                      {trip.budget ? ` · Orçamento: ${formatCurrency(trip.budget)}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-text-tertiary">
                    {done}/{trip.checklist.length} feitos
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-1.5">
                  {trip.checklist.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleTripChecklistItem(trip.id, item.id)}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-fast ease-out hover:bg-white/[0.04]"
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                          item.done ? 'border-accent-green bg-accent-green/20' : 'border-white/20'
                        )}
                      >
                        {item.done && <Check className="h-3 w-3 text-accent-green" />}
                      </span>
                      <span className={item.done ? 'text-text-tertiary line-through' : 'text-text-secondary'}>
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </GlassCard>
            </FadeIn>
          );
        })}
      </div>
    </div>
  );
}
