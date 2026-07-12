'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { CommandCenter } from '@/components/command/command-center';

// Canvas + randomização de posição são inerentemente client-only. `ssr:
// false` evita mismatch de hidratação e mantém o SSR/streaming do restante
// da página intacto (Nova Experience — Fase 1 — requisito de Performance).
const BackgroundNetwork = dynamic(
  () => import('@/components/backgrounds/background-network').then((mod) => mod.BackgroundNetwork),
  { ssr: false }
);

/**
 * Layout Principal — casca estrutural de toda área autenticada do CONTROL OS
 * (Background vivo + Sidebar + Topbar + conteúdo). Compartilhado por
 * Dashboard e, nas fases seguintes, por todas as demais telas.
 */
export function LayoutPrincipal({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-bg">
      <BackgroundNetwork />
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <CommandCenter />
    </div>
  );
}
