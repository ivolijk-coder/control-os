'use client';

import * as React from 'react';
import { AlertTriangle, CalendarClock, Clock3, MapPin, Trash2 } from 'lucide-react';
import { FadeIn } from '@/components/dashboard/fade-in';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/dashboard/section-header';
import { ChartCard } from '@/components/dashboard/chart-card';
import { TimelineCard, type TimelineCardItem } from '@/components/dashboard/timeline-card';
import { RecommendationCard } from '@/components/dashboard/recommendation-card';
import { InsightCard } from '@/components/dashboard/insight-card';
import { useDataStore } from '@/lib/data-store';
import { cn } from '@/lib/utils';
import { toLocalDateString } from '@/services/nova';
import type { AgendaEvent } from '@control-os/types';

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Bugfix: usava `date.toISOString().slice(0, 10)` (UTC) — ver `services/nova/date.ts`. */
function isoDate(date: Date): string {
  return toLocalDateString(date);
}

function formatEventDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' }).format(
    new Date(`${date}T00:00:00`)
  );
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const mins = Math.floor(minutes % 60)
    .toString()
    .padStart(2, '0');
  return `${hours}:${mins}`;
}

function eventToTimelineItem(event: AgendaEvent, accent?: 'purple' | 'blue' | 'green' | 'red'): TimelineCardItem {
  return {
    id: event.id,
    icon: CalendarClock,
    title: event.title,
    meta: [event.time, event.location].filter(Boolean).join(' · ') || formatEventDate(event.date),
    accent,
  };
}

/**
 * Agenda — módulo premium (CONTROL OS — Etapa 10B).
 *
 * Continua lendo só `useDataStore.agendaEvents` — nenhum campo novo no tipo
 * `AgendaEvent`. "Conflitos" e "tempo livre" são cálculos puros sobre
 * `date`/`time` que já existem (dois eventos no mesmo horário exato =
 * conflito; o intervalo entre dois eventos marcados no mesmo dia = tempo
 * livre) — nada fabricado, nada assumido que não esteja no dado real.
 */
export default function AgendaPage() {
  const agendaEvents = useDataStore((state) => state.agendaEvents);
  const deleteAgendaEvent = useDataStore((state) => state.deleteAgendaEvent);

  const todayIso = isoDate(new Date());
  const in7Days = isoDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  const sorted = [...agendaEvents].sort(
    (a, b) => new Date(`${a.date}T${a.time ?? '00:00'}`).getTime() - new Date(`${b.date}T${b.time ?? '00:00'}`).getTime()
  );

  const todayEvents = sorted.filter((event) => event.date === todayIso);
  const weekEvents = sorted.filter((event) => event.date > todayIso && event.date <= in7Days);
  const laterEvents = sorted.filter((event) => event.date > in7Days);

  // Conflitos: dois compromissos com data + horário idênticos.
  const conflictKey = (event: AgendaEvent) => (event.time ? `${event.date}T${event.time}` : null);
  const keyCounts = new Map<string, AgendaEvent[]>();
  for (const event of sorted) {
    const key = conflictKey(event);
    if (!key) continue;
    keyCounts.set(key, [...(keyCounts.get(key) ?? []), event]);
  }
  const conflicts = Array.from(keyCounts.values()).filter((group) => group.length > 1);

  // Tempo livre hoje: intervalo entre compromissos consecutivos com horário
  // marcado — só o que dá pra calcular com o dado real (sem duração).
  const timedToday = todayEvents.filter((event): event is AgendaEvent & { time: string } => Boolean(event.time));
  const freeGaps: { start: string; end: string }[] = [];
  for (let i = 0; i < timedToday.length - 1; i += 1) {
    const current = timedToday[i];
    const next = timedToday[i + 1];
    if (!current || !next) continue;
    const gapMinutes = timeToMinutes(next.time) - timeToMinutes(current.time);
    if (gapMinutes >= 60) {
      freeGaps.push({ start: current.time, end: next.time });
    }
  }

  // Calendário mensal — mês corrente, dias com compromisso marcados.
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysWithEvents = new Set(
    agendaEvents
      .filter((event) => event.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
      .map((event) => Number(event.date.slice(-2)))
  );
  const monthCells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const todayDay = now.getDate();
  const [selectedDate, setSelectedDate] = React.useState(todayIso);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
  const selectedDay = Number(selectedDate.slice(-2));
  const selectedEvents = sorted.filter((event) => event.date === selectedDate);

  const selectDay = (day: number) => {
    setSelectedDate(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    setPendingDeleteId(null);
  };

  const nextEvent = sorted.find((event) => new Date(`${event.date}T${event.time ?? '00:00'}`).getTime() >= Date.now());
  const biggestGap = freeGaps.length > 0 ? freeGaps.reduce((a, b) => (timeToMinutes(b.end) - timeToMinutes(b.start) > timeToMinutes(a.end) - timeToMinutes(a.start) ? b : a)) : null;

  const resumoNova = nextEvent
    ? `Seu próximo compromisso é "${nextEvent.title}"${nextEvent.time ? ` às ${nextEvent.time}` : ''}.${
        biggestGap ? ` Maior intervalo livre hoje: ${biggestGap.start}–${biggestGap.end}.` : ''
      }`
    : 'Nenhum compromisso à frente — sua agenda está livre.';

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <FadeIn>
        <SectionHeader level="page" title="Agenda" meta={`${sorted.length} compromissos`} />
      </FadeIn>

      <FadeIn delay={0.05}>
        <RecommendationCard text={resumoNova} />
      </FadeIn>

      {conflicts.length > 0 && (
        <FadeIn delay={0.07}>
          <div className="flex flex-col gap-2">
            {conflicts.map((group, index) => (
              <InsightCard
                key={index}
                icon={AlertTriangle}
                accent="red"
                title="Conflito de agenda"
                description={`${group.map((event) => event.title).join(' e ')} no mesmo horário (${formatEventDate(
                  group[0]?.date ?? ''
                )} · ${group[0]?.time}).`}
              />
            ))}
          </div>
        </FadeIn>
      )}

      <FadeIn delay={0.1}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
          <ChartCard title="Este mês" description="Toque em um dia para ver os compromissos">
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {WEEKDAY_LABELS.map((label, index) => (
                <span key={index} className="text-[10px] text-text-tertiary">
                  {label}
                </span>
              ))}
              {monthCells.map((day, index) => (
                <button
                  key={index}
                  type="button"
                  disabled={day === null}
                  onClick={() => day !== null && selectDay(day)}
                  aria-label={day === null ? undefined : `Ver compromissos do dia ${day}`}
                  className={cn(
                    'relative flex h-9 items-center justify-center rounded-lg text-xs transition-colors disabled:pointer-events-none',
                    day === null && 'invisible',
                    day !== null && day === selectedDay && daysWithEvents.has(day) ? 'bg-accent-gold text-black font-semibold' : '',
                    day !== null && day === selectedDay && !daysWithEvents.has(day) ? 'bg-accent-purple text-white font-semibold' : '',
                    day !== selectedDay && day === todayDay ? 'border border-accent-purple/50 text-accent-purple' : 'text-text-secondary hover:bg-tint/[0.06]',
                    day !== null && day !== selectedDay && daysWithEvents.has(day) && 'bg-accent-gold/15 font-semibold text-accent-gold'
                  )}
                >
                  {day ?? ''}
                  {day !== null && day !== selectedDay && daysWithEvents.has(day) && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent-gold" />}
                </button>
              ))}
            </div>
          </ChartCard>

          <ChartCard title={selectedDate === todayIso ? 'Hoje' : 'Dia selecionado'} description={formatEventDate(selectedDate)}>
            {selectedEvents.length > 0 ? (
              <div className="flex flex-col gap-2">
                {selectedEvents.map((event) => (
                  <article key={event.id} className="rounded-xl border border-tint/[0.08] bg-tint/[0.03] p-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-gold/15 text-accent-gold"><CalendarClock className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary">{event.title}</p>
                        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-tertiary">
                          {event.time && <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{event.time}</span>}
                          {event.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{event.location}</span>}
                        </p>
                      </div>
                      {pendingDeleteId === event.id ? (
                        <span className="flex shrink-0 items-center gap-1">
                          <button type="button" onClick={() => { deleteAgendaEvent(event.id); setPendingDeleteId(null); }} className="rounded-lg bg-crit px-2 py-1.5 text-[11px] font-medium text-crit-ink">Excluir</button>
                          <button type="button" onClick={() => setPendingDeleteId(null)} className="rounded-lg border border-tint/[0.1] px-2 py-1.5 text-[11px] text-text-secondary">Cancelar</button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setPendingDeleteId(event.id)} aria-label={`Excluir ${event.title}`} className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-accent-red/10 hover:text-accent-red"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-tertiary">Nada marcado para este dia.</p>
            )}
          </ChartCard>
        </div>
      </FadeIn>

      {sorted.length === 0 && (
        <FadeIn delay={0.12}>
          <EmptyState
            icon={CalendarClock}
            title="Nenhum compromisso ainda."
            description='Conte para a Nova, ex.: "Tenho dentista amanhã" ou "Reunião às 15h".'
          />
        </FadeIn>
      )}

      {weekEvents.length > 0 && (
        <FadeIn delay={0.14}>
          <div className="flex flex-col gap-3">
            <SectionHeader title="Esta semana" meta={`${weekEvents.length}`} />
            <TimelineCard items={weekEvents.map((event) => eventToTimelineItem(event, 'blue'))} />
          </div>
        </FadeIn>
      )}

      {laterEvents.length > 0 && (
        <FadeIn delay={0.17}>
          <div className="flex flex-col gap-3">
            <SectionHeader title="Próximos eventos" meta={`${laterEvents.length}`} />
            <TimelineCard items={laterEvents.map((event) => eventToTimelineItem(event))} />
          </div>
        </FadeIn>
      )}
    </div>
  );
}
