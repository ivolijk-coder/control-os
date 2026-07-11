import { FadeIn } from '@/components/dashboard/fade-in';
import { StatCard } from '@/components/dashboard/stat-card';
import { MissionCard } from '@/components/dashboard/mission-card';
import { TimelineFeed } from '@/components/dashboard/timeline-feed';
import { NovaSuggestionCard } from '@/components/dashboard/nova-suggestion-card';
import { MOCK_MISSIONS, MOCK_NOVA_MESSAGES, MOCK_STATS, MOCK_TIMELINE, MOCK_USER } from '@/lib/mock-data';

/**
 * Dashboard Vivo™ — Fase 1.
 *
 * Dados mockados de lib/mock-data.ts. Nenhuma chamada de IA, banco de dados
 * ou WhatsApp acontece aqui ainda — isso entra em fases futuras.
 */
export default function DashboardPage() {
  const firstName = MOCK_USER.name.split(' ')[0];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">
            Bom dia, {firstName}.
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Aqui está o que está acontecendo no seu ecossistema hoje.
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <NovaSuggestionCard message={MOCK_NOVA_MESSAGES[0]} />
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MOCK_STATS.map((stat) => (
            <StatCard key={stat.id} stat={stat} />
          ))}
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <FadeIn delay={0.15}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-text-primary">Missões em destaque</h2>
              <span className="text-xs text-text-tertiary">{MOCK_MISSIONS.length} missões ativas</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {MOCK_MISSIONS.map((mission) => (
                <MissionCard key={mission.id} mission={mission} />
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <TimelineFeed events={MOCK_TIMELINE} />
        </FadeIn>
      </div>
    </div>
  );
}
