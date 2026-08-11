'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { NovaPersona } from '@/services/nova';
import { cn } from '@/lib/utils';

const DOTS = [0, 1, 2] as const;

/** Estados intermediários da NOVA — ver `services/nova/interfaces` (`NovaStatus`). */
export type NovaThinkingStatus = 'pensando' | 'executando';

const STATUS_LABEL: Record<NovaThinkingStatus, string> = {
  pensando: 'Pensando',
  executando: 'Executando',
};

export interface NovaThinkingProps {
  status?: NovaThinkingStatus;
  /** Mesma dualidade roxo/dourado do avatar em `NovaMessageBubble` (CONTROL OS — Etapa 16E). Padrão `'nova'`. */
  persona?: NovaPersona;
}

/**
 * NovaThinking — indicador de estado intermediário da NOVA (Nova Experience
 * — Fase 2, rotulado no CONTROL OS 3.0 com "Pensando"/"Executando"). Aparece
 * entre o envio da mensagem e a resposta, dando ritmo de conversa real.
 */
export function NovaThinking({ status = 'pensando', persona = 'nova' }: NovaThinkingProps) {
  const isLegendary = persona === 'legendary';
  return (
    <div className="flex items-start gap-3 px-1">
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isLegendary ? 'bg-accent-gold/15 text-accent-gold' : 'bg-accent-purple/15 text-accent-purple'
        )}
      >
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="flex items-center gap-2 rounded-2xl border border-tint/[0.08] bg-card/60 px-4 py-3.5 backdrop-blur-md">
        <span className="text-xs text-text-tertiary">{STATUS_LABEL[status]}</span>
        <div className="flex items-center gap-1.5">
          {DOTS.map((index) => (
            <motion.span
              key={index}
              className="h-1.5 w-1.5 rounded-full bg-text-tertiary"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut', delay: index * 0.15 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
