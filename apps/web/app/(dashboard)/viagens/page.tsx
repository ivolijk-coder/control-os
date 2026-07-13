'use client';

import { AlertTriangle, Check, FileText, MapPin, Plane } from 'lucide-react';
import { FadeIn } from '@/components/dashboard/fade-in';
import { GlassCard } from '@/components/ui/glass-card';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/dashboard/section-header';
import { ProgressRing } from '@/components/dashboard/progress-ring';
import { InsightCard } from '@/components/dashboard/insight-card';
import { useDataStore } from '@/lib/data-store';
import { cn, formatCurrency } from '@/lib/utils';

const DOCUMENT_KEYWORDS = ['passaporte', 'visto', 'seguro', 'identidade', 'rg', 'cnh', 'vacina'];

function formatRange(start: string, end: string): string {
  const format = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
  return `${format.format(new Date(start))} – ${format.format(new Date(end))}`;
}

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/**
 * Viagens — módulo premium (CONTROL OS — Etapa 10B), "Trip Planner".
 *
 * Continua sendo `Trip.checklist` (`toggleTripChecklistItem`, sem mudança).
 * "Documentos necessários" é um filtro sobre os próprios itens do checklist
 * cujo texto sugere documento (passaporte, visto, seguro...) — não existe
 * relação `Trip↔PersonalDocument` no modelo de dado, então não finjo que
 * existe; é uma leitura mais inteligente do mesmo checklist. "Mapa" é um
 * indicador ilustrativo de rota (não há coordenadas reais no dado) — deixa
 * a tela com cara de planner sem fingir ter geolocalização.
 */
export default function ViagensPage() {
  const trips = useDataStore((state) => state.trips);
  const toggleTripChecklistItem = useDataStore((state) => state.toggleTripChecklistItem);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <SectionHeader level="page" title="Viagens" meta={`${trips.length} planejadas`} />
      </FadeIn>

      {trips.length === 0 && (
        <FadeIn delay={0.05}>
          <EmptyState icon={Plane} title="Nenhuma viagem planejada ainda." />
        </FadeIn>
      )}

      <div className="flex flex-col gap-5">
        {trips.map((trip, index) => {
          const done = trip.checklist.filter((item) => item.done).length;
          const progress = trip.checklist.length > 0 ? (done / trip.checklist.length) * 100 : 0;
          const restante = daysUntil(trip.startDate);
          const pendentes = trip.checklist.filter((item) => !item.done);
          const documentItems = trip.checklist.filter((item) =>
            DOCUMENT_KEYWORDS.some((keyword) => item.label.toLowerCase().includes(keyword))
          );
          const pendingDocuments = documentItems.filter((item) => !item.done);

          return (
            <FadeIn key={trip.id} delay={0.05 * (index + 1)}>
              <GlassCard interactive={false} className="p-5">
                <div className="flex items-start gap-4">
                  <ProgressRing value={progress} size={52} strokeWidth={5} accent="purple">
                    <span className="font-mono text-xs font-semibold text-text-primary">{Math.round(progress)}%</span>
                  </ProgressRing>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
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

                {/* Rota ilustrativa — sem geolocalização real, só reforça o "planner". */}
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-text-tertiary" />
                  <span className="h-px flex-1 bg-gradient-to-r from-white/20 via-white/10 to-transparent" />
                  <Plane className="h-3.5 w-3.5 shrink-0 -rotate-45 text-accent-purple" />
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-white/20" />
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-accent-purple" />
                  <span className="shrink-0 text-xs text-text-secondary">{trip.destination}</span>
                </div>

                {restante >= 0 && pendentes.length > 0 && (
                  <div className="mt-4">
                    <InsightCard
                      icon={AlertTriangle}
                      accent={restante <= 14 ? 'red' : 'blue'}
                      title={`Faltam ${restante} dia${restante === 1 ? '' : 's'} para a viagem`}
                      description={`${pendentes.length} item${pendentes.length === 1 ? '' : 'ns'} do checklist ainda pendente${pendentes.length === 1 ? '' : 's'}.`}
                    />
                  </div>
                )}

                {pendingDocuments.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-tertiary">
                      <FileText className="h-3 w-3" />
                      Documentos necessários
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {pendingDocuments.map((item) => (
                        <span
                          key={item.id}
                          className="rounded-full border border-accent-red/20 bg-accent-red/10 px-3 py-1 text-xs text-accent-red"
                        >
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-1.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">Checklist</p>
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
