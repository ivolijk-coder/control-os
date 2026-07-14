'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Mic } from 'lucide-react';
import { blurIn, hoverLift, transitionOut } from '@/lib/motion';
import { useAppStore } from '@/lib/store';

/** Saudação por horário do dia — parte do "parecer uma conversa", não um dashboard. */
function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * HomeHero — a Home deixa de parecer um dashboard e passa a parecer uma
 * conversa (CONTROL OS — Etapa 9: NOVA Experience — "a NOVA passa a ser o
 * centro do CONTROL OS"). Continua sendo só a saudação: o campo de texto,
 * sugestões rápidas, conversa e painel inteligente vivem em `NovaWorkspace`,
 * montado logo abaixo deste componente em `app/(dashboard)/nova/page.tsx`. O
 * CTA de voz (Etapa 8) permanece como a ação principal sugerida.
 *
 * CONTROL OS — Etapa 11: "Mobile-first — NOVA grande/central/sozinha ao
 * abrir, módulos abaixo." Até a Etapa 10B, este componente também renderizava
 * o resumo do dia (insights) logo abaixo da saudação — em telas pequenas,
 * isso empurrava a esfera (`NovaOrb`) para baixo da dobra, o oposto do
 * pedido. Esse conteúdo foi extraído para `HomeContextPanel`, que agora vive
 * depois da esfera (`belowOrbContent` em `NovaWorkspace`) — mesmos dados,
 * mesmo Recommendation Engine, só numa posição que deixa a esfera como
 * primeiro elemento de peso visual ao abrir a Home, em qualquer tamanho de
 * tela. Este componente volta a ser apenas a saudação + o CTA de voz.
 */
export function HomeHero({ firstName }: { firstName: string }) {
  const setNovaVoiceOpen = useAppStore((state) => state.setNovaVoiceOpen);

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={blurIn}
      transition={transitionOut(0.4)}
      className="flex flex-col items-center gap-5 pb-2 pt-14 text-center"
    >
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
          {getTimeOfDayGreeting()}, {firstName}.
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
