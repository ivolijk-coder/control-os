'use client';

import type { TimelineEventType } from '@control-os/types';
import { Badge } from '@control-os/ui';
import { FadeIn } from '@/components/dashboard/fade-in';
import { GlassCard } from '@/components/ui/glass-card';
import { ICON_MAP } from '@/components/layout/icon-map';
import { useDataStore } from '@/lib/data-store';

const TYPE_ICON: Record<TimelineEventType, keyof typeof ICON_MAP> = {
  missao_criada: 'Target',
  missao_concluida: 'Target',
  execucao: 'Activity',
  mensagem_nova: 'Sparkles',
  documento: 'FileText',
  financeiro: 'Wallet',
  agenda_criada: 'CalendarClock',
  sistema: 'Settings',
};

const ACTOR_LABEL: Record<'user' | 'nova' | 'sistema', string> = {
  user: 'Você',
  nova: 'Nova',
  sistema: 'Sistema',
};

const ACTOR_VARIANT: Record<'user' | 'nova' | 'sistema', 'neutral' | 'green' | 'blue' | 'purple' | 'red'> = {
  user: 'blue',
  nova: 'purple',
  sistema: 'neutral',
};

function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

/**
 * Timeline — Control Feed™ (CONTROL OS — Etapa 3).
 *
 * Antes desta página, `/timeline` era um item de menu sem rota criada
 * (herança da Fase 1, nunca terminada). Os dados já existiam em
 * `useDataStore` (todo `addTimelineEvent` de qualquer módulo — Financeiro,
 * Missões, Nova — já alimentava esse array); faltava só esta tela pra
 * mostrá-los. Módulo de Empresa (histórico de execuções/eventos), por isso
 * fica no grupo secundário da Sidebar nesta etapa.
 */
export default function TimelinePage() {
  const timeline = useDataStore((state) => state.timeline);

  const sorted = [...timeline].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text-primary">Timeline</h1>
          <span className="text-xs text-text-tertiary">{sorted.length} eventos</span>
        </div>
      </FadeIn>

      {sorted.length === 0 && (
        <FadeIn delay={0.05}>
          <GlassCard interactive={false} className="p-8 text-center text-sm text-text-secondary">
            Nenhum evento ainda. Toda ação criada pela Nova ou manualmente aparece aqui.
          </GlassCard>
        </FadeIn>
      )}

      <div className="flex flex-col gap-2">
        {sorted.map((event, index) => {
          const Icon = ICON_MAP[TYPE_ICON[event.type]];
          return (
            <FadeIn key={event.id} delay={0.03 * index}>
              <GlassCard interactive={false} className="p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-text-secondary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-text-primary">{event.title}</p>
                      <Badge variant={ACTOR_VARIANT[event.actor]} className="shrink-0">
                        {ACTOR_LABEL[event.actor]}
                      </Badge>
                    </div>
                    {event.description && (
                      <p className="text-xs text-text-secondary">{event.description}</p>
                    )}
                    <p className="text-xs text-text-tertiary">{formatTimestamp(event.timestamp)}</p>
                  </div>
                </div>
              </GlassCard>
            </FadeIn>
          );
        })}
      </div>
    </div>
  );
}
