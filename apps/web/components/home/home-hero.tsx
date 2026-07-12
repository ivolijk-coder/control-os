'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Activity, Target, Wallet } from 'lucide-react';
import { NovaInput } from '@/components/nova/nova-input';
import { QuickAction } from '@/components/ui/quick-action';
import { blurIn, transitionOut } from '@/lib/motion';

const QUICK_ACTIONS = [
  { icon: Target, label: 'Organizar meu dia' },
  { icon: Wallet, label: 'Ver financeiro' },
  { icon: Activity, label: 'Como está minha empresa?' },
] as const;

/**
 * HomeHero — tela viva da Home (Fase 2: Nova Experience).
 *
 * Substitui o antigo cabeçalho estático "Bom dia, {nome}" do Dashboard
 * Vivo™: saudação central + campo da NOVA + sugestões rápidas, com muito
 * espaço em branco ao redor. Nenhuma lógica de IA — apenas a casca visual.
 */
export function HomeHero({ firstName }: { firstName: string }) {
  return (
    <section className="flex flex-col items-center gap-8 py-14 text-center">
      <motion.div initial="hidden" animate="visible" variants={blurIn} transition={transitionOut(0.4)}>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
          Olá, {firstName}.
        </h1>
        <p className="mt-2 text-sm text-text-secondary">O que você quer resolver agora?</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitionOut(0.4, 0.1)}
        className="w-full max-w-2xl"
      >
        <NovaInput />
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {QUICK_ACTIONS.map((action) => (
            <QuickAction key={action.label} icon={action.icon} label={action.label} />
          ))}
        </div>
      </motion.div>
    </section>
  );
}
