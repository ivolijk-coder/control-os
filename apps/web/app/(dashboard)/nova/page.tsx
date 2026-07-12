import { HomeHero } from '@/components/home/home-hero';
import { TodaySummary } from '@/components/home/today-summary';
import { NovaWorkspace } from '@/components/nova/nova-workspace';
import { MOCK_USER } from '@/lib/mock-data';

/**
 * Home conversacional pura do CONTROL OS (CONTROL OS — Etapa 3).
 *
 * Saudação (`HomeHero`) + resumo real do dia (`TodaySummary`) + campo de
 * conversa da Nova com o Painel Inteligente sempre visível abaixo — nada
 * de grade de métricas tradicional ou navegação aqui. O Dashboard continua
 * existindo em `/dashboard`, alcançável pela Sidebar, como um módulo — não
 * foi removido nem teve conteúdo redistribuído. Em qualquer outra tela, a
 * mesma conversa fica disponível pelo `NovaFloatingLauncher` — sem precisar
 * voltar pra essa rota.
 */
export default function NovaPage() {
  const firstName = MOCK_USER.name.split(' ')[0] ?? MOCK_USER.name;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col justify-center gap-6 px-6 py-8">
      <div className="flex flex-col gap-3">
        <HomeHero firstName={firstName} />
        <TodaySummary />
      </div>
      <NovaWorkspace />
    </div>
  );
}
