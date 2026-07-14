import { HomeHero } from '@/components/home/home-hero';
import { HomeContextPanel } from '@/components/home/home-context-panel';
import { HomeSummaryStrip } from '@/components/home/home-summary-strip';
import { NovaWorkspace } from '@/components/nova/nova-workspace';
import { MOCK_USER } from '@/lib/mock-data';

/**
 * Home conversacional pura do CONTROL OS (CONTROL OS — Etapa 3).
 *
 * Propositalmente limpa — pedido explícito do usuário: "só a bola no
 * meio", sem painéis ou cards, pra dar a sensação de estar conversando com
 * alguém. Só a saudação (`HomeHero`, some assim que a conversa começa) e a
 * esfera da Nova (`NovaOrb`, dentro do `NovaWorkspace` em modo `docked`),
 * que cresce enquanto ela pensa/executa, com o campo de conversa fixo no
 * rodapé. O Dashboard continua existindo em `/dashboard`, alcançável pela
 * Sidebar, como um módulo — não foi removido nem teve conteúdo
 * redistribuído. Em qualquer outra tela, a mesma conversa fica disponível
 * pelo `NovaFloatingLauncher` — sem precisar voltar pra essa rota.
 *
 * CONTROL OS — Etapa 11: abaixo da esfera (antes da primeira mensagem),
 * `HomeContextPanel` (resumo do dia, alertas, oportunidades, missões) e
 * `HomeSummaryStrip` (financeiro/agenda/hábitos) fecham a leitura de
 * contexto pedida pelo spec, na mesma ordem conceitual do documento — sem
 * virar um dashboard permanente: somem assim que a conversa começa, igual
 * `HomeHero`. Ficam depois da esfera (não antes, como na Etapa 10B) por
 * causa do requisito "Mobile-first — NOVA sozinha ao abrir" (ver comentário
 * em `HomeHero`).
 */
export default function NovaPage() {
  const firstName = MOCK_USER.name.split(' ')[0] ?? MOCK_USER.name;

  return (
    <NovaWorkspace
      variant="docked"
      topContent={<HomeHero firstName={firstName} />}
      belowOrbContent={
        <div className="flex w-full flex-col items-center gap-6">
          <HomeContextPanel />
          <HomeSummaryStrip />
        </div>
      }
    />
  );
}
