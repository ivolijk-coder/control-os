'use client';

import { FadeIn } from '@/components/dashboard/fade-in';
import { GlassCard } from '@/components/ui/glass-card';
import { ICON_MAP } from '@/components/layout/icon-map';
import { useDataStore } from '@/lib/data-store';

function formatEventDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${date}T00:00:00`));
}

/**
 * Agenda — módulo pessoal (CONTROL OS — Sistema Operacional Pessoal).
 *
 * Lê `useDataStore.agendaEvents` — mesma fonte usada pela Nova quando cria
 * um compromisso por conversa ("Tenho reunião amanhã às 15h", "Tenho
 * dentista amanhã"). Ordenada por data (a mais próxima primeiro, diferente
 * da Timeline/Financeiro que mostram o mais recente primeiro) — aqui o que
 * importa é o que vem a seguir, não o que já aconteceu.
 */
export default function AgendaPage() {
  const agendaEvents = useDataStore((state) => state.agendaEvents);

  const sorted = [...agendaEvents].sort(
    (a, b) => new Date(`${a.date}T${a.time ?? '00:00'}`).getTime() - new Date(`${b.date}T${b.time ?? '00:00'}`).getTime()
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text-primary">Agenda</h1>
          <span className="text-xs text-text-tertiary">{sorted.length} compromissos</span>
        </div>
      </FadeIn>

      {sorted.length === 0 && (
        <FadeIn delay={0.05}>
          <GlassCard interactive={false} className="p-8 text-center text-sm text-text-secondary">
            Nenhum compromisso ainda. Conte para a Nova, ex.: &quot;Tenho dentista amanhã&quot; ou &quot;Reunião às 15h&quot;.
          </GlassCard>
        </FadeIn>
      )}

      <div className="flex flex-col gap-2">
        {sorted.map((event, index) => (
          <FadeIn key={event.id} delay={0.04 * index}>
            <GlassCard interactive={false} className="p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md bg-white/[0.06] text-text-secondary">
                  <ICON_MAP.CalendarClock className="h-4 w-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-sm text-text-primary">{event.title}</p>
                  <p className="text-xs text-text-tertiary">
                    {formatEventDate(event.date)}
                    {event.time ? ` · ${event.time}` : ''}
                    {event.location ? ` · ${event.location}` : ''}
                  </p>
                </div>
              </div>
            </GlassCard>
          </FadeIn>
        ))}
      </div>
    </div>
  );
}
