'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { blurIn, transitionOut } from '@/lib/motion';

/**
 * HomeHero — saudação central da Home viva (Nova Experience — Fase 1).
 *
 * Só a saudação: o campo da NOVA, sugestões rápidas, conversa e painel
 * inteligente vivem em `NovaWorkspace` (Nova Experience — Fase 2), montado
 * logo abaixo deste componente em `dashboard/page.tsx`.
 */
export function HomeHero({ firstName }: { firstName: string }) {
  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={blurIn}
      transition={transitionOut(0.4)}
      className="flex flex-col items-center gap-2 pb-8 pt-14 text-center"
    >
      <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
        Olá, {firstName}.
      </h1>
      <p className="text-sm text-text-secondary">O que você quer resolver agora?</p>
    </motion.section>
  );
}
