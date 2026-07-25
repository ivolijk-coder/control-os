'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Avatar, AvatarFallback, Button } from '@control-os/ui';
import { getInitials } from '@/lib/utils';
import { MOCK_NAV_ITEMS, MOCK_USER } from '@/lib/mock-data';
import { useAppStore } from '@/lib/store';
import { ICON_MAP } from './icon-map';

function pageTitleFromPath(pathname: string | null): string {
  const match = [...MOCK_NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname?.startsWith(item.href));
  return match?.label ?? 'CONTROL OS';
}

/**
 * Topbar — busca universal, Command Center (⌘K) e presença do usuário.
 * Fixa no topo da área de conteúdo, dentro do Layout Principal.
 *
 * CONTROL OS — Etapa 10A: busca ganhou glow de foco (mesma cor de acento do
 * resto do sistema), o avatar ganhou um anel sutil e o indicador de
 * notificação ganhou um brilho discreto — nada de novo funcionalmente, só a
 * barra parecendo mais "viva" ao toque.
 *
 * Teste de uso real (30 min como usuária pagante): em telas estreitas
 * (~390px) a barra "Buscar em tudo..." não tinha nenhuma versão mobile —
 * era a mesma barra larga do desktop espremida no espaço que sobrava entre
 * o menu e os botões da direita, e o texto quebrava em 3 linhas, vazando
 * pra fora da altura do cabeçalho. Abaixo de `md` ela agora vira um botão
 * só com o ícone de busca (mesmo alvo de toque do botão de menu); a barra
 * completa com o atalho "⌘K" volta a partir de `md`. "Nova Missão" segue o
 * mesmo princípio — o texto some antes de `sm`, sobra só o ícone.
 */
export function Topbar() {
  const pathname = usePathname();
  const title = pageTitleFromPath(pathname);
  const setCommandCenterOpen = useAppStore((s) => s.setCommandCenterOpen);
  const setMobileNavOpen = useAppStore((s) => s.setMobileNavOpen);

  return (
    // CONTROL OS — Etapa 16C (Design System premium): mesmo tratamento de
    // "espessura de vidro" da Sidebar (Etapa 16C) — uma linha de luz de 1px
    // no topo do painel, simulando a mesma fonte de luz vindo de cima que
    // ilumina o resto da interface (glow/halo da NovaOrb, pedestal-glow).
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.08] bg-bg/60 px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          onClick={() => setMobileNavOpen(true)}
          aria-label="Abrir menu"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors duration-fast ease-out hover:bg-white/[0.06] hover:text-text-primary md:hidden"
        >
          <ICON_MAP.Menu className="h-4 w-4" />
        </button>
        <h1 className="truncate text-sm font-semibold text-text-primary">{title}</h1>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 md:justify-center md:px-8">
        {/* Mobile (< md): só o ícone — a barra completa não cabe ao lado do
            menu e dos botões da direita nesse tamanho de tela. */}
        <button
          onClick={() => setCommandCenterOpen(true)}
          aria-label="Busca universal (⌘K)"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-text-tertiary transition-colors duration-fast ease-out hover:bg-white/[0.06] hover:text-text-primary md:hidden"
        >
          <ICON_MAP.Search className="h-4 w-4" />
        </button>
        {/* Desktop (>= md): barra completa com o atalho de teclado. */}
        <button
          onClick={() => setCommandCenterOpen(true)}
          // Etapa 16C: mesmo realce de espessura de vidro do cabeçalho,
          // aplicado à própria barra de busca — ela também é uma superfície
          // de vidro, não só o header por trás dela.
          className="hidden w-full max-w-md items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-text-tertiary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition-all duration-fast ease-out hover:scale-[1.01] hover:border-white/20 hover:bg-white/[0.05] active:scale-[0.99] focus-visible:scale-[1.01] focus-visible:border-accent-purple/40 focus-visible:shadow-glow-purple focus-visible:outline-none md:flex"
          aria-label="Busca universal (⌘K)"
        >
          <ICON_MAP.Search className="h-4 w-4" />
          <span className="flex-1 text-left">Buscar em tudo...</span>
          <kbd className="flex items-center gap-0.5 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary">
            <ICON_MAP.Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Button variant="secondary" size="sm" className="gap-1.5">
          <ICON_MAP.Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Nova Missão</span>
        </Button>
        <button
          aria-label="Notificações"
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-text-secondary transition-all duration-fast ease-out hover:scale-110 hover:bg-white/[0.06] hover:text-text-primary active:scale-95"
        >
          <ICON_MAP.Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent-red shadow-[0_0_6px_2px_rgba(239,68,68,0.4)]" />
        </button>
        <Avatar className="hidden h-8 w-8 cursor-pointer ring-1 ring-white/10 transition-all duration-fast ease-out hover:scale-105 hover:ring-white/20 active:scale-95 sm:flex">
          <AvatarFallback>{getInitials(MOCK_USER.name)}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
