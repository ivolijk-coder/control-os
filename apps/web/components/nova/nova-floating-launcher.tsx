'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { hoverLift } from '@/lib/motion';

// Escondido em /nova: a conversa já é o conteúdo principal dessa tela — não
// faz sentido empilhar duas superfícies de conversa uma sobre a outra.
const HIDDEN_ON_PREFIXES = ['/nova'];

// Canvas é inerentemente client-only — mesmo tratamento do BackgroundNetwork.
const NovaOrb = dynamic(() => import('@/components/nova/nova-orb').then((mod) => mod.NovaOrb), {
  ssr: false,
});

/**
 * NovaFloatingLauncher — botão flutuante permanente da Nova
 * (CONTROL OS — Etapa 3; reformulado na Etapa 8 — NOVA Voice Experience).
 *
 * "Não é apenas um microfone. É o centro do sistema." Canto inferior
 * direito, desktop e mobile, sempre visível por cima do conteúdo da
 * página — antes um ícone estático (`Sparkles`), agora a própria `NovaOrb`
 * em miniatura. A respiração vem de dentro da própria orb desde a Etapa
 * 10A (overhaul visual — respiração, pulso, ondas), não mais de uma classe
 * `animate-breathe` externa — evita duas animações de escala competindo no
 * mesmo elemento.
 *
 * Ao tocar, abre o Modo Conversa por voz em tela cheia (`NovaVoiceOverlay`)
 * — não mais o painel de texto (`NovaFloatingPanel`/`novaPanelOpen`, que
 * continua existindo no código e acessível pela Home em `/nova`, só deixou
 * de ser o que este botão abre).
 */
export function NovaFloatingLauncher() {
  const pathname = usePathname();
  const setNovaVoiceOpen = useAppStore((state) => state.setNovaVoiceOpen);

  if (pathname && HIDDEN_ON_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <motion.button
      type="button"
      onClick={() => setNovaVoiceOpen(true)}
      aria-label="Conversar com a Nova"
      className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-accent-purple/90 shadow-e5 backdrop-blur-md"
      {...hoverLift}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <NovaOrb status="idle" className="h-full w-full" />
    </motion.button>
  );
}
