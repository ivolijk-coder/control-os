import { FadeIn } from '@/components/dashboard/fade-in';
import { MetricCard } from '@/components/dashboard/metric-card';
import { MissionCard } from '@/components/dashboard/mission-card';
import { TimelineFeed } from '@/components/dashboard/timeline-feed';
import { NovaSuggestionCard } from '@/components/dashboard/nova-suggestion-card';
import { HomeHero } from '@/components/home/home-hero';
import { NovaWorkspace } from '@/components/nova/nova-workspace';
import { MOCK_MISSIONS, MOCK_NOVA_MESSAGES, MOCK_STATS, MOCK_TIMELINE, MOCK_USER } from '@/lib/mock-data';

/**
 * Home viva do CONTROL OS — Nova Experience.
 *
 * Substitui o antigo "dashboard tradicional" por uma tela viva: saudação
 * (`HomeHero`, Fase 1) + Modo de Conversa e Painel inteligente
 * (`NovaWorkspace`, Fase 2), seguidos pelo conteúdo existente (sugestão da
 * Nova, métricas, missões, timeline) em superfícies de vidro. Dados
 * mockados de lib/mock-data.ts — nenhuma chamada de IA real, banco de dados
 * ou WhatsApp acontece aqui ainda.
 */
export default function DashboardPage() {
  const firstName = MOCK_USER.name.split(' ')[0] ?? MOCK_USER.name;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <HomeHero firstName={firstName} />
      <NovaWorkspace />

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
              <span className="text-xs text-text-tertiary">{MOCK_MISSIONS.length} missões ativas</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {MOCK_MISSIONS.map((mission) => (
                <MissionCard key={mission.id} mission={mission} />
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.15}>
          <TimelineFeed events={MOCK_TIMELINE} />
        </FadeIn>
      </div>
    </div>
  );
}
