'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRoutePersona } from '@/lib/use-route-persona';
import { ICON_MAP } from './icon-map';

/**
 * MobileBottomNav — CONTROL OS: "otimização completa da experiência
 * mobile... o sistema deve parecer ter sido desenhado primeiro para
 * mobile." + "no mobile, priorize apenas o que realmente importa: IA,
 * Financeiro, Agenda, Metas, Hábitos. Todo o restante deve ficar em segundo
 * plano."
 *
 * Antes, mobile só tinha o drawer da Sidebar (hambúrguer no topo, ver
 * `Topbar`) — uma lista plana com os 12 destinos do produto, sem hierarquia
 * nenhuma entre eles, exigindo dois toques (abrir menu → escolher) e uma
 * mão alcançando o topo da tela pra qualquer navegação. Essa barra fixa no
 * rodapé coloca os 5 destinos de uso diário a UM toque do polegar, sempre
 * visíveis — "experiência pensada para uso com uma mão".
 *
 * "Todo o restante em segundo plano" não significa removido: Visão geral
 * (Dashboard), Documentos, Patrimônio, Viagens, Notas e Configurações
 * continuam exatamente onde sempre estiveram — no drawer da Sidebar, atrás
 * do botão de menu do `Topbar`. Só pararam de disputar espaço aqui embaixo
 * com o que o usuário realmente abre todo dia.
 *
 * Só existe abaixo de `md` (`md:hidden`) — desktop/tablet continuam com a
 * Sidebar como única navegação, sem nenhuma barra nova.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { effectivePersona, routePersona } = useRoutePersona();

  // "IA" é um destino só (não dois botões NOVA/LEGENDARY competindo por
  // espaço) — leva sempre pra identidade ATUALMENTE ativa (mesma fonte de
  // verdade que o resto do produto, `useRoutePersona`). Trocar de NOVA pra
  // LEGENDARY (ou vice-versa) continua possível pelo drawer da Sidebar
  // (`nav_nova`/`nav_legendary` já existem lá) — nenhuma capacidade perdida,
  // só um caminho de entrada mais rápido pro dia a dia.
  const iaHref = effectivePersona === 'legendary' ? '/legendary' : '/nova';
  const iaActive = routePersona !== undefined;

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-white/[0.08] bg-bg/85 pb-[max(env(safe-area-inset-bottom),0.5rem)] backdrop-blur-xl md:hidden"
    >
      <MobileNavLink
        href={iaHref}
        label="IA"
        Icon={ICON_MAP.Sparkles}
        active={iaActive}
        accent={effectivePersona === 'legendary' ? 'gold' : 'purple'}
      />
      <MobileNavLink
        href="/financeiro"
        label="Financeiro"
        Icon={ICON_MAP.Wallet}
        active={pathname?.startsWith('/financeiro') ?? false}
      />
      <MobileNavLink
        href="/agenda"
        label="Agenda"
        Icon={ICON_MAP.CalendarClock}
        active={pathname?.startsWith('/agenda') ?? false}
      />
      <MobileNavLink
        href="/metas"
        label="Metas"
        Icon={ICON_MAP.Trophy}
        active={pathname?.startsWith('/metas') ?? false}
      />
      <MobileNavLink
        href="/habitos"
        label="Hábitos"
        Icon={ICON_MAP.Repeat}
        active={pathname?.startsWith('/habitos') ?? false}
      />
    </nav>
  );
}

function MobileNavLink({
  href,
  label,
  Icon,
  active,
  accent = 'purple',
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
  accent?: 'purple' | 'gold';
}) {
  return (
    <Link
      href={href}
      // `py-2` + ícone de 20px + rótulo + gap somam ~56px de altura de
      // toque — acima do mínimo de 44pt recomendado (Apple HIG) mesmo antes
      // da folga extra de `safe-area-inset-bottom` do `<nav>` pai.
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors duration-fast ease-out active:scale-95',
        active
          ? accent === 'gold'
            ? 'text-[#F4D889]'
            : 'text-accent-purple'
          : 'text-text-tertiary hover:text-text-secondary'
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
