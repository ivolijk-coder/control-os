'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { FloatingPanel } from '@/components/ui/floating-panel';
import { useAppStore } from '@/lib/store';
import { MOCK_NAV_ITEMS_EMPRESA, MOCK_NAV_ITEMS_VIDA } from '@/lib/mock-data';
import { ICON_MAP } from '@/components/layout/icon-map';

const ALL_NAV_ITEMS = [...MOCK_NAV_ITEMS_VIDA, ...MOCK_NAV_ITEMS_EMPRESA];

/**
 * CommandCenter — Command Center (⌘K), Nova Experience — Fase 3.
 *
 * Completa o botão de busca do Topbar (que antes não tinha função) e o
 * estado `commandCenterOpen` do store (já existia desde a Fase 1, nunca
 * usado por nenhuma tela). Navega entre telas que já existem — não cria
 * rotas novas, só destrava o atalho ⌘K/Ctrl+K.
 */
export function CommandCenter() {
  const router = useRouter();
  const open = useAppStore((s) => s.commandCenterOpen);
  const setOpen = useAppStore((s) => s.setCommandCenterOpen);
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isShortcut) return;
      event.preventDefault();
      setOpen(!open);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, setOpen]);

  React.useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const filtered = ALL_NAV_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  function goTo(href: string) {
    router.push(href);
    setOpen(false);
  }

  return (
    <FloatingPanel
      open={open}
      onOpenChange={setOpen}
      title="Command Center"
      description="Busque e navegue pelo CONTROL OS"
    >
      <div className="border-b border-white/[0.08] px-4 py-3">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar em tudo..."
          aria-label="Buscar em tudo"
          className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
        />
      </div>
      <ul className="max-h-80 overflow-y-auto p-2">
        {filtered.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-text-tertiary">Nada encontrado.</li>
        )}
        {filtered.map((item) => {
          const Icon = ICON_MAP[item.icon];
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => goTo(item.href)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-text-secondary transition-colors duration-fast ease-out hover:bg-white/[0.06] hover:text-text-primary"
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </FloatingPanel>
  );
}
