import { HomeHero } from '@/components/home/home-hero';
import { NovaWorkspace } from '@/components/nova/nova-workspace';
import { MOCK_USER } from '@/lib/mock-data';

/**
 * Home conversacional pura do CONTROL OS (CONTROL OS 3.0).
 *
 * Substitui o Dashboard como tela de entrada: só a saudação (`HomeHero`) e
 * o campo de conversa da Nova (`NovaWorkspace`, com check-in diário
 * ativado) — nada de grade de métricas ou navegação tradicional aqui. O
 * Dashboard continua existindo em `/dashboard`, reachable pela Sidebar,
 * como um módulo — não foi removido nem teve conteúdo redistribuído.
 */
export default function NovaPage() {
  const firstName = MOCK_USER.name.split(' ')[0] ?? MOCK_USER.name;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col justify-center gap-6 px-6 py-8">
      <HomeHero firstName={firstName} />
      <NovaWorkspace dailyCheckIn />
    </div>
  );
}
