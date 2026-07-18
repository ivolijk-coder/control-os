'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Check, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { transitionOut } from '@/lib/motion';
import { getSpeechProvider } from '@/services/voice';

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

/** Origem do envio — texto digitado ou frase capturada pelo microfone inline. */
export type NovaInputSource = 'text' | 'voice';

export interface NovaInputProps {
  className?: string;
  /** Chamado quando o usuário envia uma mensagem — por texto ou por voz (ver `NovaWorkspace`). */
  onSubmit: (value: string, source: NovaInputSource) => void;
  /** Desabilita o envio (ex.: enquanto a NOVA está "pensando"). */
  disabled?: boolean;
  /**
   * Chamado quando a captura de voz inline começa/termina — permite ao pai
   * (`NovaWorkspace`) refletir `'ouvindo'` na `NovaOrb` enquanto o
   * microfone está ativo (CONTROL OS — Etapa 11C).
   */
  onListeningChange?: (listening: boolean) => void;
}

/**
 * NovaInput — campo central da NOVA (Nova Experience — Fase 2; microfone
 * inline adicionado na Etapa 11C — "campo de conversa unificado, estilo
 * ChatGPT/Gemini: falar, escrever e enviar coexistem, o microfone nunca
 * desaparece").
 *
 * Componente de captura: mantém o texto digitado (ou a transcrição ao vivo,
 * enquanto o microfone está ativo), o placeholder cíclico e o pulso de
 * confirmação de envio. O que acontece depois do envio (turno da conversa,
 * painel) é responsabilidade do `NovaWorkspace`, que fornece `onSubmit` —
 * chamado da mesma forma tanto pro texto digitado quanto pra frase falada
 * (só o `source` muda), então os dois caem exatamente no mesmo fluxo de
 * conversa (`novaMessages`), nunca um canal separado.
 *
 * O microfone usa o mesmo `SpeechProvider` (`services/voice`) já usado pelo
 * Modo Conversa em tela cheia (`NovaVoiceOverlay`) — nenhuma captura de voz
 * nova, só um segundo lugar de onde ela pode ser iniciada. Clique →
 * escuta imediatamente → fala final → envia sozinho, sem confirmações ou
 * cliques extras ("sem etapas extras" — Etapa 11C).
 */
export function NovaInput({ className, onSubmit, disabled = false, onListeningChange }: NovaInputProps) {
  const [value, setValue] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const [exampleIndex, setExampleIndex] = React.useState(0);
  const [justSent, setJustSent] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const [interimTranscript, setInterimTranscript] = React.useState('');

  const speechSupported = React.useMemo(() => getSpeechProvider().isSupported, []);

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

  // Libera o microfone se o componente desmontar (ou o pai desabilitar)
  // enquanto ainda está ouvindo — nunca deixa a captura presa em segundo
  // plano.
  React.useEffect(() => {
    return () => {
      getSpeechProvider().stop();
    };
  }, []);

  const stopListening = React.useCallback(() => {
    getSpeechProvider().stop();
    setIsListening(false);
    setInterimTranscript('');
    onListeningChange?.(false);
  }, [onListeningChange]);

  const startListening = React.useCallback(() => {
    if (!speechSupported || disabled) return;
    setIsListening(true);
    setInterimTranscript('');
    onListeningChange?.(true);
    getSpeechProvider().start({
      onResult: (result) => {
        setInterimTranscript(result.transcript);
        if (result.isFinal && result.transcript.trim().length > 0) {
          const transcript = result.transcript.trim();
          getSpeechProvider().stop();
          setIsListening(false);
          setInterimTranscript('');
          onListeningChange?.(false);
          onSubmit(transcript, 'voice');
        }
      },
      onError: () => {
        setIsListening(false);
        setInterimTranscript('');
        onListeningChange?.(false);
      },
      onEnd: () => {
        setIsListening(false);
        setInterimTranscript('');
        onListeningChange?.(false);
      },
    });
  }, [speechSupported, disabled, onListeningChange, onSubmit]);

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed, 'text');
    setValue('');
    setJustSent(true);
  };

  // Enquanto o microfone está ativo, o campo espelha a transcrição ao vivo
  // em vez do texto digitado — os dois nunca competem pelo mesmo espaço ao
  // mesmo tempo, mas o mic e o botão de enviar continuam visíveis o tempo
  // todo ("o microfone nunca desaparece").
  const displayValue = isListening ? interimTranscript : value;
  const showOverlay = displayValue.length === 0 && !focused && !isListening;

  return (
    <div className="relative w-full">
      {/* Legenda ao vivo: bolha acima do campo espelhando o que está sendo
          digitado ou falado. */}
      <AnimatePresence>
        {displayValue.length > 0 && (
          <motion.div
            key="live-caption"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={transitionOut(0.2)}
            className="absolute bottom-full left-1/2 mb-3 max-w-[90%] -translate-x-1/2 rounded-2xl bg-white px-4 py-2 text-sm font-medium text-black shadow-e4"
          >
            {displayValue}
          </motion.div>
        )}
      </AnimatePresence>

      <form
        onSubmit={handleSubmit}
        className={cn(
          'group relative flex items-center gap-3 rounded-2xl border bg-card/60 px-5 py-4 shadow-e4 backdrop-blur-xl transition-colors duration-base ease-out',
          focused || isListening ? 'border-accent-purple/40' : 'border-white/[0.08] hover:border-white/[0.14]',
          className
        )}
      >
        {/* Microfone — sempre visível, nunca substitui o campo de texto nem
            o botão de enviar ("os dois coexistem" — Etapa 11C). */}
        <motion.button
          type="button"
          onClick={handleMicClick}
          disabled={!speechSupported || disabled}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          animate={isListening ? { scale: [1, 1.12, 1] } : { scale: 1 }}
          transition={isListening ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } : transitionOut(0.2)}
          aria-label={isListening ? 'Parar de ouvir' : 'Falar com a Nova'}
          aria-pressed={isListening}
          title={speechSupported ? undefined : 'Este navegador não suporta reconhecimento de voz'}
          className={cn(
            // CONTROL OS — Etapa 12B: h-8/w-8 (32px) ficava abaixo do alvo de
            // toque confortável ("botões grandes... nada apertado") pro
            // botão mais importante do produto — a NOVA é o centro absoluto
            // da experiência, e este é o gatilho de voz dela.
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-fast ease-out disabled:cursor-not-allowed disabled:opacity-30',
            isListening ? 'bg-accent-purple text-white' : 'text-accent-purple hover:bg-accent-purple/10'
          )}
        >
          <Mic className="h-4 w-4" />
        </motion.button>

        <div className="relative flex-1">
          <input
            value={displayValue}
            onChange={(event) => setValue(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                if (isListening) {
                  stopListening();
                  return;
                }
                setValue('');
                event.currentTarget.blur();
              }
            }}
            readOnly={isListening}
            disabled={disabled}
            placeholder="Digite uma mensagem..."
            aria-label="Digite ou fale com a NOVA"
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
          disabled={disabled || displayValue.trim().length === 0}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          animate={justSent ? { scale: [1, 1.15, 1] } : { scale: 1 }}
          transition={transitionOut(0.4)}
          aria-label="Enviar para a NOVA"
          // CONTROL OS — Etapa 12B: h-9/w-9 (36px) → h-11/w-11 (44px), o
          // alvo de toque confortável de referência (Apple HIG) — ação de
          // envio é a mais frequente do campo, merece o maior botão dos dois.
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black transition-opacity duration-fast ease-out disabled:opacity-30"
        >
          {justSent ? <Check className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
        </motion.button>
      </form>
    </div>
  );
}
