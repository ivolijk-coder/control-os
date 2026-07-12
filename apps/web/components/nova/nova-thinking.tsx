'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const DOTS = [0, 1, 2] as const;

/**
 * NovaThinking — indicador de "processando" da NOVA (Nova Experience —
 * Fase 2). Aparece entre o envio da mensagem e a resposta mockada, dando
 * ritmo de conversa real sem depender de latência de rede.
 */
export function NovaThinking() {
  return (
    <div className="flex items-start gap-3 px-1">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-purple/15 text-accent-purple">
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="flex items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-card/60 px-4 py-3.5 backdrop-blur-md">
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
  );
}
