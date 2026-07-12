'use client';

import { FadeIn } from '@/components/dashboard/fade-in';
import { MetricCard } from '@/components/dashboard/metric-card';
import { MissionCard } from '@/components/dashboard/mission-card';
import { TimelineFeed } from '@/components/dashboard/timeline-feed';
import { NovaSuggestionCard } from '@/components/dashboard/nova-suggestion-card';
import { MOCK_NOVA_MESSAGES, MOCK_STATS } from '@/lib/mock-data';
import { useDataStore } from '@/lib/data-store';

/**
 * Dashboard — módulo de métricas, missões e timeline (CONTROL OS 3.0).
 *
 * Deixou de ser a Home do sistema — a Home agora é a conversa pura com a
 * Nova em `/nova`. O Dashboard continua existindo exatamente com o mesmo
 * layout de antes (sugestão da Nova, métricas, missões, timeline), apenas
 * alcançável pela Sidebar em vez de ser a tela de entrada. `MOCK_STATS` (a
 * grade de métricas do topo) permanece intocada; Missões e Timeline agora
 * leem de `useDataStore` — a mesma fonte que a conversa com a Nova escreve
 * — em vez do mock estático anterior.
 */
export default function DashboardPage() {
  const missions = useDataStore((state) => state.missions);
  const timeline = useDataStore((state) => state.timeline);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <NovaSuggestionCard message={MOCK_NOVA_MESSAGES[0]} />
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MOCK_STATS.map((stat) => (
            <MetricCard key={stat.id} stat={stat} />
          ))}
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <FadeIn delay={0.1}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-text-primary">Missões em destaque</h2>
              <span className="text-xs text-text-tertiary">{missions.length} missões ativas</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {missions.map((mission) => (
                <MissionCard key={mission.id} mission={mission} />
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.15}>
          <TimelineFeed events={timeline} />
        </FadeIn>
      </div>
    </div>
  );
}
