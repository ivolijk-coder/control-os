'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { blurIn, transitionOut } from '@/lib/motion';

/**
 * HomeHero — saudação central da Home conversacional pura (`/nova`,
 * CONTROL OS 3.0). Só a saudação: o campo da NOVA, sugestões rápidas,
 * conversa e painel inteligente vivem em `NovaWorkspace`, montado logo
 * abaixo deste componente em `app/(dashboard)/nova/page.tsx`.
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
        Olá, {firstName} 👋
      </h1>
      <p className="text-sm text-text-secondary">Como posso ajudar você hoje?</p>
    </motion.section>
  );
}
