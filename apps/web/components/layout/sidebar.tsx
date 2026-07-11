'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, Badge, Separator } from '@control-os/ui';
import { cn, getInitials } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { MOCK_NAV_ITEMS, MOCK_SPACES, MOCK_USER } from '@/lib/mock-data';
import { ICON_MAP } from './icon-map';

// Tailwind não resolve classes montadas por interpolação de string em tempo
// de build — por isso os tokens de cor por Space usam um mapa estático de
// classes completas, em vez de `bg-accent-${color}/15`.
const SPACE_COLOR_CLASSES: Record<string, string> = {
  green: 'bg-accent-green/15 text-accent-green',
  blue: 'bg-accent-blue/15 text-accent-blue',
  purple: 'bg-accent-purple/15 text-accent-purple',
  red: 'bg-accent-red/15 text-accent-red',
};

/**
 * Sidebar — navegação principal do CONTROL OS.
 *
 * Regras de UX herdadas da documentação (Etapa 4/5): no máximo 3 níveis de
 * navegação; a Sidebar representa o nível 1 (Spaces + itens globais).
 * Colapsa para modo ícone-apenas, estado persistido via Zustand.
 */
export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 76 : 264 }}
      transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex h-screen flex-col border-r border-white/[0.08] bg-[#08080a]"
    >
      {/* Cabeçalho / marca */}
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-xs font-bold text-black">
          C
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight text-text-primary">CONTROL OS</span>
        )}
      </div>

      <Separator />

      {/* Control Spaces */}
      <div className="flex flex-col gap-1 px-3 py-4">
        {!collapsed && (
          <span className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
            Spaces
          </span>
        )}
        {MOCK_SPACES.map((space) => {
          const Icon = ICON_MAP[space.icon] ?? ICON_MAP.User;
          return (
            <button
              key={space.id}
              className={cn(
                'group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors duration-fast ease-out',
                space.isActive
                  ? 'bg-white/[0.06] text-text-primary'
                  : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary'
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                  SPACE_COLOR_CLASSES[space.color]
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              {!collapsed && (
                <>
                  <span className="flex-1 truncate text-left">{space.name}</span>
                  <span className="text-xs text-text-tertiary">{space.missionsCount}</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <Separator />

      {/* Navegação global */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {!collapsed && (
          <span className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
            Navegação
          </span>
        )}
        {MOCK_NAV_ITEMS.map((item) => {
          const Icon = ICON_MAP[item.icon] ?? ICON_MAP.LayoutGrid;
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors duration-fast ease-out',
                isActive
                  ? 'bg-white/[0.08] text-text-primary'
                  : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary'
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="sidebar-active-indicator"
                  className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent-purple"
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && item.badge ? (
                <Badge variant="purple" className="ml-auto">
                  {item.badge}
                </Badge>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* Rodapé: usuário + colapsar */}
      <div className="flex items-center gap-3 p-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{getInitials(MOCK_USER.name)}</AvatarFallback>
        </Avatar>
        {!collapsed && (
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-text-primary">{MOCK_USER.name}</span>
            <span className="truncate text-xs text-text-tertiary">{MOCK_USER.company}</span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-tertiary transition-colors duration-fast ease-out hover:bg-white/[0.06] hover:text-text-primary"
        >
          {collapsed ? (
            <ICON_MAP.ChevronsRight className="h-4 w-4" />
          ) : (
            <ICON_MAP.ChevronsLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </motion.aside>
  );
}
