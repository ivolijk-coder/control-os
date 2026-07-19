'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import type { NovaPersona } from '@/services/nova';
import type { NovaOrbStatus } from '@/components/nova/nova-orb';
import { NovaRingObject } from '@/components/nova/nova-ring-object';
import { Skeleton } from '@/components/ui/skeleton';
import { transitionOut } from '@/lib/motion';

// Canvas é inerentemente client-only — mesmo tratamento de sempre pro Hero
// Scene em R3F (ver comentário original em `nova-workspace.tsx`, Etapa 17).
const NovaHeroScene = dynamic(() => import('@/components/nova/nova-hero-scene').then((mod) => mod.NovaHeroScene), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-full" />,
});

export interface NovaHeroStageProps {
  status?: NovaOrbStatus;
  pulseSignal?: number;
  persona: NovaPersona;
}

/**
 * CONTROL OS — HERO SCENE REBOOT: decide QUAL Hero Object montar por
 * persona. NOVA passou a usar `NovaRingObject` (CSS flat, réplica do
 * mockup enviado pelo usuário) — LEGENDARY continua em `NovaHeroScene`
 * (React Three Fiber, cristal facetado), intocado.
 *
 * As duas tecnologias são incompatíveis pra cross-dissolve interno (uma é
 * DOM/CSS, a outra é um canvas WebGL) — a transição entre personas aqui é
 * um fade simples por `AnimatePresence`, não mais o blend contínuo que
 * acontecia dentro do Canvas do R3F quando as duas eram cenas 3D. Escopo
 * desta troca é só a NOVA; se/quando a LEGENDARY também sair do R3F, o
 * cross-dissolve pode voltar a ser reavaliado.
 */
export function NovaHeroStage({ status = 'idle', pulseSignal, persona }: NovaHeroStageProps) {
  return (
    <div className="relative h-full w-full">
      <AnimatePresence mode="wait">
        {persona === 'nova' ? (
          <motion.div
            key="nova-ring"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitionOut(0.3)}
          >
            <NovaRingObject />
          </motion.div>
        ) : (
          <motion.div
            key="legendary-scene"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitionOut(0.3)}
          >
            <NovaHeroScene status={status} pulseSignal={pulseSignal} persona={persona} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
