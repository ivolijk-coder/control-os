'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Mic } from 'lucide-react';
import { blurIn, hoverLift, transitionOut } from '@/lib/motion';
import { useAppStore } from '@/lib/store';

/**
 * HomeHero — saudação central da Home conversacional pura (`/nova`,
 * CONTROL OS 3.0; CTA de voz adicionado na Etapa 8 — NOVA Voice
 * Experience). Só a saudação e, agora, a ação sugerida principal: "a Home
 * destaca a NOVA... a primeira ação sugerida deve ser 'Converse com a
 * NOVA'". O campo de texto, sugestões rápidas, conversa e painel
 * inteligente continuam vivendo em `NovaWorkspace`, montado logo abaixo
 * deste componente em `app/(dashboard)/nova/page.tsx` — este botão só abre
 * o Modo Conversa por voz (`NovaVoiceOverlay`), a mesma superfície aberta
 * pelo botão flutuante global em qualquer outra tela.
 */
export function HomeHero({ firstName }: { firstName: string }) {
  const setNovaVoiceOpen = useAppStore((state) => state.setNovaVoiceOpen);

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={blurIn}
      transition={transitionOut(0.4)}
      className="flex flex-col items-center gap-4 pb-8 pt-14 text-center"
    >
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
          Olá, {firstName} 👋
        </h1>
        <p className="text-sm text-text-secondary">Como posso ajudar você hoje?</p>
      </div>

      <motion.button
        type="button"
        onClick={() => setNovaVoiceOpen(true)}
        {...hoverLift}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-accent-purple px-5 py-2.5 text-sm font-medium text-white shadow-e3"
      >
        <Mic className="h-4 w-4" />
        Converse com a Nova
      </motion.button>
    </motion.section>
  );
}
