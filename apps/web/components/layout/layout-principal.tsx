'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { CommandCenter } from '@/components/command/command-center';
import { NovaFloatingLauncher } from '@/components/nova/nova-floating-launcher';
import { NovaFloatingPanel } from '@/components/nova/nova-floating-panel';
import { NovaVoiceOverlay } from '@/components/nova/nova-voice-overlay';

// Canvas + randomização de posição são inerentemente client-only. `ssr:
// false` evita mismatch de hidratação e mantém o SSR/streaming do restante
// da página intacto (Nova Experience — Fase 1 — requisito de Performance).
const BackgroundNetwork = dynamic(
  () => import('@/components/backgrounds/background-network').then((mod) => mod.BackgroundNetwork),
  { ssr: false }
);

/**
 * Layout Principal — casca estrutural de toda área autenticada do CONTROL OS
 * (Background vivo + Sidebar + Topbar + conteúdo). Compartilhado por todas
 * as telas autenticadas — inclui o `NovaFloatingLauncher` (CONTROL OS —
 * Etapa 3): a Nova acompanha o usuário em qualquer módulo sem trocar de
 * página.
 *
 * `pb-24` em `<main>` (teste de uso real, 30 min como usuária pagante): o
 * launcher é `fixed bottom-6 right-6`, sempre por cima do conteúdo — sem
 * essa folga reservada, a última linha/card de qualquer página (ex.:
 * "Pagar parcela" em Financeiro) renderizava exatamente atrás dele e ficava
 * parcialmente coberta. `pb-24` (96px — maior que os 56px do botão + a
 * margem de 24px) garante que o fim rolável de qualquer tela sempre deixa
 * esse canto livre, sem precisar tocar cada página uma por uma.
 */
export function LayoutPrincipal({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-bg bg-ambient-glow bg-fixed motion-safe:animate-ambient-drift">
      <BackgroundNetwork />
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto pb-24">{children}</main>
      </div>
      <CommandCenter />
      <NovaFloatingLauncher />
      <NovaFloatingPanel />
      <NovaVoiceOverlay />
    </div>
  );
}
