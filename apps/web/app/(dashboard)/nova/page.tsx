import { HomeHero } from '@/components/home/home-hero';
import { TodaySummary } from '@/components/home/today-summary';
import { NovaSourceCards } from '@/components/home/nova-source-cards';
import { NovaWorkspace } from '@/components/nova/nova-workspace';
import { MOCK_USER } from '@/lib/mock-data';

/**
 * Home conversacional pura do CONTROL OS (CONTROL OS — Etapa 3).
 *
 * Saudação (`HomeHero`) + resumo real do dia (`TodaySummary`) + cards de
 * itens reais (`NovaSourceCards`) + a esfera da Nova (`NovaOrb`, dentro do
 * `NovaWorkspace` em modo `docked`) + campo de conversa fixo no rodapé —
 * estilo inspirado em referência visual enviada pelo usuário. Nada de
 * grade de métricas tradicional ou navegação aqui. O Dashboard continua
 * existindo em `/dashboard`, alcançável pela Sidebar, como um módulo — não
 * foi removido nem teve conteúdo redistribuído. Em qualquer outra tela, a
 * mesma conversa fica disponível pelo `NovaFloatingLauncher` — sem precisar
 * voltar pra essa rota.
 */
export default function NovaPage() {
  const firstName = MOCK_USER.name.split(' ')[0] ?? MOCK_USER.name;

  return (
    <NovaWorkspace
      variant="docked"
      topContent={
        <>
          <div className="flex flex-col gap-3">
            <HomeHero firstName={firstName} />
            <TodaySummary />
          </div>
          <NovaSourceCards />
        </>
      }
    />
  );
}
