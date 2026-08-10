'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { CommandCenter } from '@/components/command/command-center';
import { NovaFloatingLauncher } from '@/components/nova/nova-floating-launcher';
import { NovaFloatingPanel } from '@/components/nova/nova-floating-panel';
import { NovaVoiceOverlay } from '@/components/nova/nova-voice-overlay';
import { PersonaAmbientGlow, PersonaTransitionStage } from '@/components/layout/persona-transition';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { useRoutePersona } from '@/lib/use-route-persona';

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
 * `pb-28 md:pb-24` em `<main>` (teste de uso real, 30 min como usuária
 * pagante): no desktop/tablet o launcher é `fixed bottom-6 right-6`, sempre
 * por cima do conteúdo — sem essa folga reservada, a última linha/card de
 * qualquer página (ex.: "Pagar parcela" em Financeiro) renderizava
 * exatamente atrás dele e ficava parcialmente coberta. `md:pb-24` (96px —
 * maior que os 56px do botão + a margem de 24px) garante isso a partir de
 * `md`. Abaixo de `md`, quem cobre o rodapé é a `MobileBottomNav`.
 *
 * `pb-36` (144px) abaixo de `md`, e não mais `pb-28` (112px): a barra deixou
 * de ser uma faixa de largura cheia e virou uma pílula flutuante com a marca
 * da persona ELEVADA acima dela (ver `mobile-bottom-nav.tsx`). A conta do
 * pior caso — pílula ~71px + folga de 8px + `safe-area-inset-bottom` de 34px
 * do iPhone + 27px que o orb sobe — chega a ~140px, acima dos 112px que
 * bastavam para a faixa antiga. Sem esta folga, a última linha de uma página
 * longa passaria por baixo do orb na coluna central.
 *
 * CONTROL OS — Etapa 16F (Art Direction — Orb como coração do sistema): o
 * glow ambiente do fundo (`bg-ambient-glow`) e as partículas de destaque do
 * `BackgroundNetwork` seguiam SEMPRE roxo/azul, em toda página autenticada
 * — mesmo com a LEGENDARY conduzindo a conversa em `/nova`. Isso quebrava a
 * própria ideia de "a Orb é o coração do sistema, o resto da interface
 * parece iluminado por ela": a identidade da persona ativa parava na Orb e
 * no seletor, nunca chegava ao ambiente. Lê `effectivePersona`
 * (`useRoutePersona`) e troca a cor do glow de fundo + das partículas
 * juntas, em qualquer tela do produto — não só `/nova`.
 *
 * CONTROL OS — "transição cinematográfica entre NOVA e LEGENDARY": o glow
 * de fundo agora é `PersonaAmbientGlow` (cross-fade animado, não mais uma
 * className trocada na hora) e `{children}` é envolvido por
 * `PersonaTransitionStage` — juntos fazem a troca de rota entre /nova e
 * /legendary parecer "a interface se transformando", não um corte seco.
 * Fora dessas duas rotas, `PersonaTransitionStage` é um passthrough
 * (`routePersona` indefinido) — nenhuma outra tela do produto muda de
 * comportamento.
 *
 * CONTROL OS — "otimização completa da experiência mobile": `MobileBottomNav`
 * (só abaixo de `md`) coloca os destinos de uso diário — Visão, Financeiro,
 * Relatórios, Documentos — a um toque do polegar, com a marca da persona
 * ativa como ponto de acesso central à IA. O resto do produto não sumiu:
 * continua no drawer da Sidebar, atrás do botão de menu do `Topbar`, só
 * deixou de disputar espaço aqui embaixo.
 */
export function LayoutPrincipal({ children }: { children: React.ReactNode }) {
  const { effectivePersona } = useRoutePersona();

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-bg">
      <PersonaAmbientGlow persona={effectivePersona} />
      <BackgroundNetwork persona={effectivePersona} />
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto pb-36 md:pb-24">
          <PersonaTransitionStage>{children}</PersonaTransitionStage>
        </main>
      </div>
      <CommandCenter />
      <NovaFloatingLauncher />
      <NovaFloatingPanel />
      <NovaVoiceOverlay />
      <MobileBottomNav />
    </div>
  );
}
