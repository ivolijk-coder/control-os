'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import type { NovaPersona } from '@/services/nova';
import { cn } from '@/lib/utils';
import { transitionSpring } from '@/lib/motion';

export interface NovaPersonaSwitchProps {
  persona: NovaPersona;
  onChange: (persona: NovaPersona) => void;
  className?: string;
}

const OPTIONS: ReadonlyArray<{ value: NovaPersona; label: string }> = [
  { value: 'nova', label: 'NOVA' },
  { value: 'legendary', label: 'LEGENDARY' },
];

/**
 * NovaPersonaSwitch — seletor premium minimalista entre as duas
 * inteligências do mesmo ecossistema (CONTROL OS — Etapa 15: LEGENDARY).
 * Nunca um menu, nunca um dropdown, nunca uma segunda tela — dois rótulos
 * lado a lado com um "vidro" deslizante (`layoutId`, spring) atrás do
 * rótulo ativo, o mesmo padrão de vidro/glow já usado no resto do produto
 * (`glass`, `shadow-glow-purple`/`shadow-glow-gold`). A troca NUNCA cria uma
 * conversa nova, nunca limpa `novaMessages`, nunca navega de rota — só muda
 * `activePersona` no `useAppStore` (ver `lib/store.ts`), que por sua vez só
 * altera qual `SystemPrompt`/identidade visual conduz o PRÓXIMO turno. É
 * essa ausência total de efeito colateral estrutural que garante "nunca
 * parecer trocar de chatbot": a mesma conversa, o mesmo histórico, a mesma
 * `NovaOrb` continuam exatamente onde estavam.
 */
export function NovaPersonaSwitch({ persona, onChange, className }: NovaPersonaSwitchProps) {
  return (
    <div
      role="tablist"
      aria-label="Escolher identidade da conversa"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border border-tint/10 bg-tint/[0.04] p-1 backdrop-blur-sm',
        className
      )}
    >
      {OPTIONS.map((option) => {
        const active = option.value === persona;
        const isLegendary = option.value === 'legendary';
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              // CONTROL OS — Etapa 16H (Responsividade): px-3.5/py-1.5
              // rendia um alvo de toque de ~28px de altura — abaixo do
              // mínimo confortável já usado em outros controles frequentes
              // do produto (mic/enviar da NovaInput foram de 32px pra 40-
              // 44px na Etapa 12B, citando o Apple HIG). Este é o único
              // controle que troca a identidade inteira da conversa
              // (NOVA/LEGENDARY) — merece o mesmo padrão. Mantém a pílula
              // compacta (nunca vira um botão grande) — só ganha respiro
              // vertical.
              'relative rounded-full px-4 py-2.5 text-[11px] font-semibold tracking-wide transition-colors duration-fast ease-out',
              active ? 'text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
            )}
          >
            {active && (
              <motion.span
                layoutId="nova-persona-switch-active"
                transition={transitionSpring}
                className={cn(
                  'absolute inset-0 rounded-full border',
                  isLegendary ? 'border-accent-gold/30 bg-accent-gold/[0.14] shadow-glow-gold' : 'border-accent-purple/30 bg-accent-purple/[0.14] shadow-glow-purple'
                )}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
