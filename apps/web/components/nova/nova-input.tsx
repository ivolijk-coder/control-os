'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { transitionOut } from '@/lib/motion';

const EXAMPLE_PROMPTS = [
  'crie uma missão',
  'como está minha empresa?',
  'quanto gastei esse mês?',
  'organize meu dia',
  'lembrar de pagar o DAS dia 20',
] as const;

const CYCLE_INTERVAL_MS = 2800;
const SENT_PULSE_MS = 900;

/** Acessa `EXAMPLE_PROMPTS` por índice cíclico sem indexação insegura. */
function getExamplePrompt(index: number): string {
  const normalized = ((index % EXAMPLE_PROMPTS.length) + EXAMPLE_PROMPTS.length) % EXAMPLE_PROMPTS.length;
  return EXAMPLE_PROMPTS[normalized] ?? EXAMPLE_PROMPTS[0];
}

export interface NovaInputProps {
  className?: string;
  /** Chamado quando o usuário envia uma mensagem (ver `NovaWorkspace`). */
  onSubmit: (value: string) => void;
  /** Desabilita o envio (ex.: enquanto a NOVA está "pensando"). */
  disabled?: boolean;
}

/**
 * NovaInput — campo central da NOVA (Nova Experience — Fase 2).
 *
 * Componente puramente de captura: mantém o texto digitado, o placeholder
 * cíclico e o pulso de confirmação de envio. O que acontece depois do envio
 * (Modo de Conversa, painel) é responsabilidade do `NovaWorkspace`, que
 * fornece `onSubmit`.
 */
export function NovaInput({ className, onSubmit, disabled = false }: NovaInputProps) {
  const [value, setValue] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const [exampleIndex, setExampleIndex] = React.useState(0);
  const [justSent, setJustSent] = React.useState(false);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setExampleIndex((current) => current + 1);
    }, CYCLE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (!justSent) return;
    const timeout = window.setTimeout(() => setJustSent(false), SENT_PULSE_MS);
    return () => window.clearTimeout(timeout);
  }, [justSent]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue('');
    setJustSent(true);
  };

  const showOverlay = value.length === 0 && !focused;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'group relative flex items-center gap-3 rounded-2xl border bg-card/60 px-5 py-4 shadow-e4 backdrop-blur-xl transition-colors duration-base ease-out',
        focused ? 'border-accent-purple/40' : 'border-white/[0.08] hover:border-white/[0.14]',
        className
      )}
    >
      <Sparkles className="h-5 w-5 shrink-0 text-accent-purple" aria-hidden />

      <div className="relative flex-1">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setValue('');
              event.currentTarget.blur();
            }
          }}
          disabled={disabled}
          placeholder="Pergunte qualquer coisa..."
          aria-label="Pergunte qualquer coisa para a NOVA"
          className="w-full bg-transparent text-base text-text-primary placeholder:text-transparent focus:outline-none disabled:opacity-50"
        />

        <AnimatePresence mode="wait">
          {showOverlay && (
            <motion.span
              key={exampleIndex}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={transitionOut()}
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-base text-text-tertiary"
            >
              &ldquo;{getExamplePrompt(exampleIndex)}&rdquo;
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <motion.button
        type="submit"
        disabled={disabled || value.trim().length === 0}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        animate={justSent ? { scale: [1, 1.15, 1] } : { scale: 1 }}
        transition={transitionOut(0.4)}
        aria-label="Enviar para a NOVA"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black transition-opacity duration-fast ease-out disabled:opacity-30"
      >
        {justSent ? <Check className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
      </motion.button>
    </form>
  );
}
