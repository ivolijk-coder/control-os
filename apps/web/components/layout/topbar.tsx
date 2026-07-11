'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Avatar, AvatarFallback, Button } from '@control-os/ui';
import { getInitials } from '@/lib/utils';
import { MOCK_NAV_ITEMS, MOCK_USER } from '@/lib/mock-data';
import { ICON_MAP } from './icon-map';

function pageTitleFromPath(pathname: string | null): string {
  const match = MOCK_NAV_ITEMS.find((item) => pathname?.startsWith(item.href));
  return match?.label ?? 'CONTROL OS';
}

/**
 * Topbar — busca universal, Command Center (⌘K) e presença do usuário.
 * Fixa no topo da área de conteúdo, dentro do Layout Principal.
 */
export function Topbar() {
  const pathname = usePathname();
  const title = pageTitleFromPath(pathname);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.08] bg-bg/80 px-6 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-text-primary">{title}</h1>
      </div>

      <div className="flex flex-1 items-center justify-center px-8">
        <button
          className="flex w-full max-w-md items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-text-tertiary transition-colors duration-fast ease-out hover:border-white/20 hover:bg-white/[0.05]"
          aria-label="Busca universal"
        >
          <ICON_MAP.Search className="h-4 w-4" />
          <span className="flex-1 text-left">Buscar em tudo...</span>
          <kbd className="flex items-center gap-0.5 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary">
            <ICON_MAP.Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" className="gap-1.5">
          <ICON_MAP.Plus className="h-3.5 w-3.5" />
          Nova Missão
        </Button>
        <button
          aria-label="Notificações"
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-text-secondary transition-colors duration-fast ease-out hover:bg-white/[0.06] hover:text-text-primary"
        >
          <ICON_MAP.Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent-red" />
        </button>
        <Avatar className="h-8 w-8 cursor-pointer">
          <AvatarFallback>{getInitials(MOCK_USER.name)}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
