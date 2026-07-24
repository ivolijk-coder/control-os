'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Check, Mic } from 'lucide-react';
import type { NovaPersona } from '@/services/nova';
import { cn } from '@/lib/utils';
import { transitionOut } from '@/lib/motion';
import { getSpeechProvider, getVoiceProvider } from '@/services/voice';

/**
 * Placeholder cíclico por persona (CONTROL OS — "cada IA deve possuir sua
 * própria identidade": pedido explícito do usuário depois de notar que a
 * LEGENDARY mostrava os mesmos exemplos operacionais da NOVA). NOVA sugere
 * comandos de execução (Chief Operating Officer pessoal — ver
 * `SystemPrompt.ts`); LEGENDARY sugere provocações de reflexão/estratégia
 * (mentora pessoal), nunca uma tarefa a executar.
 */
const EXAMPLE_PROMPTS_BY_PERSONA: Record<NovaPersona, readonly string[]> = {
  nova: ['organize meu dia', 'crie uma missão', 'quanto gastei esse mês?', 'como está minha empresa?', 'lembrar de pagar o DAS dia 20'],
  legendary: [
    'vamos pensar estrategicamente...',
    'sobre o que você gostaria de evoluir hoje?',
    'qual é o maior gargalo do meu negócio?',
    'como tomar essa decisão com mais clareza?',
    'me ajude a definir minha próxima grande meta',
  ],
};

const CYCLE_INTERVAL_MS = 2800;
const SENT_PULSE_MS = 900;

/** Acessa a lista de exemplos da persona ativa por índice cíclico, sem indexação insegura. */
function getExamplePrompt(persona: NovaPersona, index: number): string {
  const prompts = EXAMPLE_PROMPTS_BY_PERSONA[persona];
  const normalized = ((index % prompts.length) + prompts.length) % prompts.length;
  return prompts[normalized] ?? prompts[0] ?? '';
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
  /**
   * Identidade ativa (CONTROL OS — Etapa 16E) — colore o foco do campo e o
   * botão de microfone (roxo/dourado), o mesmo tratamento já aplicado ao
   * avatar da conversa (`NovaMessageBubble`/`NovaThinking`) e ao seletor
   * (`NovaPersonaSwitch`). Padrão `'nova'`.
   */
  persona?: NovaPersona;
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
 * conversa da persona ativa (`novaMessagesByPersona[persona]`, ver
 * `lib/store.ts`), nunca um canal separado.
 *
 * O microfone usa o mesmo `SpeechProvider` (`services/voice`) já usado pelo
 * Modo Conversa em tela cheia (`NovaVoiceOverlay`) — nenhuma captura de voz
 * nova, só um segundo lugar de onde ela pode ser iniciada. Clique →
 * escuta imediatamente → fala final → envia sozinho, sem confirmações ou
 * cliques extras ("sem etapas extras" — Etapa 11C).
 */
export function NovaInput({
  className,
  onSubmit,
  disabled = false,
  onListeningChange,
  persona = 'nova',
}: NovaInputProps) {
  const isLegendary = persona === 'legendary';
  const personaLabel = isLegendary ? 'LEGENDARY' : 'NOVA';
  const [value, setValue] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const [exampleIndex, setExampleIndex] = React.useState(0);
  const [justSent, setJustSent] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const [interimTranscript, setInterimTranscript] = React.useState('');
  const [voiceError, setVoiceError] = React.useState<string | null>(null);

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
    setVoiceError(null);
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
      onError: (message) => {
        setVoiceError(message);
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
      // CONTROL OS — bug de mobile "áudio da resposta não toca": a resposta
      // falada só acontece depois de um `await` até a IA (`handleSend` em
      // `nova-workspace.tsx`), nunca dentro deste clique — no Safari
      // iOS/Chrome Android isso é tarde demais pra liberar a síntese de voz.
      // `unlock()` precisa rodar AQUI, síncrono, enquanto o clique ainda
      // conta como gesto do usuário (ver `VoiceProvider.unlock`).
      getVoiceProvider().unlock();
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
          falado. Teste de uso real (30 min como usuária pagante): antes
          também aparecia ao digitar — duplicava, sem necessidade, o texto
          que já está visível no próprio campo logo abaixo dela (só faz
          sentido pra voz, onde a confirmação visual do que foi capturado
          importa de verdade). */}
      <AnimatePresence>
        {isListening && displayValue.length > 0 && (
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
          'group relative flex items-center gap-3 rounded-xl border bg-card/75 px-4 py-3 shadow-e4 backdrop-blur-xl transition-colors duration-base ease-out',
          // CONTROL OS — Etapa 16E: o brilho de foco do campo (a "casa" da
          // conversa) segue a mesma dualidade roxo/dourado do avatar e do
          // seletor — antes era sempre roxo, mesmo com LEGENDARY ativo.
          focused || isListening
            ? isLegendary
              ? 'border-accent-gold/40'
              : 'border-accent-purple/40'
            : 'border-white/[0.08] hover:border-white/[0.14]',
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
          aria-label={isListening ? 'Parar de ouvir' : `Falar com a ${personaLabel}`}
          aria-pressed={isListening}
          title={speechSupported ? undefined : 'Este navegador não suporta reconhecimento de voz'}
          className={cn(
            // CONTROL OS — Etapa 12B: h-8/w-8 (32px) ficava abaixo do alvo de
            // toque confortável ("botões grandes... nada apertado") pro
            // botão mais importante do produto — a NOVA é o centro absoluto
            // da experiência, e este é o gatilho de voz dela.
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-fast ease-out disabled:cursor-not-allowed disabled:opacity-30',
            isLegendary
              ? isListening
                ? 'bg-accent-gold text-black'
                : 'text-accent-gold hover:bg-accent-gold/10'
              : isListening
                ? 'bg-accent-purple text-white'
                : 'text-accent-purple hover:bg-accent-purple/10'
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
            aria-label={`Digite ou fale com a ${personaLabel}`}
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
                &ldquo;{getExamplePrompt(persona, exampleIndex)}&rdquo;
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
          aria-label={`Enviar para a ${personaLabel}`}
          // CONTROL OS — Etapa 12B: h-9/w-9 (36px) → h-11/w-11 (44px), o
          // alvo de toque confortável de referência (Apple HIG) — ação de
          // envio é a mais frequente do campo, merece o maior botão dos dois.
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black transition-opacity duration-fast ease-out disabled:opacity-30"
        >
          {justSent ? <Check className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
        </motion.button>
      </form>
      {voiceError && <p role="status" className="mt-2 px-1 text-xs text-accent-red">{voiceError}</p>}
    </div>
  );
}
