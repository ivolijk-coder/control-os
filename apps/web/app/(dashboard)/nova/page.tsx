import { HomeHero } from '@/components/home/home-hero';
import { HomeTopInsights } from '@/components/home/home-top-insights';
import { HomeSummaryStrip } from '@/components/home/home-summary-strip';
import { NovaWorkspace } from '@/components/nova/nova-workspace';
import { MOCK_USER } from '@/lib/mock-data';

/**
 * Home conversacional pura do CONTROL OS (CONTROL OS — Etapa 3; reestudada
 * por completo na Etapa 12A — "a Home deve parecer um assistente, não um
 * dashboard").
 *
 * Hierarquia fixa da Etapa 12A, de cima pra baixo: saudação + 1 frase
 * (`HomeHero`) → esfera (`NovaOrb`, dentro de `NovaWorkspace` variant=
 * "docked") → no máximo 3 insights em destaque (`HomeTopInsights`) → campo
 * de conversa (fixo no rodapé de `NovaWorkspace`, sempre visualmente depois
 * de tudo isso) → só então, exigindo rolagem, os módulos
 * (`HomeSummaryStrip`, agora cada card um link direto pro módulo). Tudo
 * some assim que a conversa começa (`messages.length === 0`, dentro de
 * `NovaWorkspace`) — a Home nunca vira um dashboard permanente por cima da
 * conversa. O Dashboard tradicional continua existindo em `/dashboard`,
 * alcançável pela Sidebar, como um módulo — não foi removido.
 *
 * `lockedPersona="nova"` — /nova virou o ambiente FIXO da NOVA (irmã de
 * `/legendary`), não mais uma tela com seletor de persona por dentro.
 * Trocar de inteligência agora é navegar entre as duas rotas, pelo botão
 * flutuante global (`NovaFloatingLauncher`).
 */
export default function NovaPage() {
  const firstName = MOCK_USER.name.split(' ')[0] ?? MOCK_USER.name;

  return (
    <NovaWorkspace
      variant="docked"
      lockedPersona="nova"
      topContent={<HomeHero firstName={firstName} />}
      belowOrbContent={
        <div className="flex w-full flex-col items-center gap-8">
          <HomeTopInsights />
          <HomeSummaryStrip />
        </div>
      }
    />
  );
}
