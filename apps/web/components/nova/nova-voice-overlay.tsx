'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { NovaOrbStatus } from '@/components/nova/nova-orb';
import { conversationService } from '@/services/ai';
import { getSpeechProvider, getVoiceProvider } from '@/services/voice';
import { useAppStore } from '@/lib/store';
import { useNovaContext } from '@/lib/use-nova-context';
import { EASE_OUT } from '@/lib/motion';

// Canvas é inerentemente client-only — mesmo tratamento do BackgroundNetwork.
const NovaOrb = dynamic(() => import('@/components/nova/nova-orb').then((mod) => mod.NovaOrb), {
  ssr: false,
});

// Sessão dedicada ao Modo Conversa por voz (CONTROL OS — Etapa 8) — separada
// da sessão padrão da conversa por texto (`DEFAULT_SESSION_ID`, interna a
// `ConversationService`) só para que uma ação sensível pendente de
// confirmação num canal nunca seja confundida com a do outro. O parâmetro
// `sessionId` já existia em `processTurn`/`confirmPending`/`cancelPending`
// desde a Etapa 7 — este é só mais um consumidor passando o dele.
//
// CONTROL OS — "separação completa entre NOVA e LEGENDARY": o prefixo
// sozinho não bastava — uma confirmação pendente por voz na NOVA vazava
// pra LEGENDARY (mesma `VOICE_SESSION_ID` pras duas). `voiceSessionId`
// abaixo, calculado por render a partir da persona ativa, resolve isso sem
// precisar de uma segunda constante.
const VOICE_SESSION_ID = 'nova_voice_overlay';

// CONTROL OS — Etapa 11: "nunca deixar a tela parada". Antes, a UI esperava
// dois delays fixos e SEQUENCIAIS (900ms de espera artificial) antes mesmo
// de começar a chamada real — piorava a lentidão em vez de disfarçar. Agora
// a chamada real (`conversationService.processTurn`) começa em 0ms, em
// paralelo com esta progressão de legendas, que só existe pra nunca deixar
// a tela em silêncio enquanto a OpenAI processa (não são eventos de
// progresso reais — o serviço não expõe isso). Assim que a resposta real
// chega, os timers restantes são cancelados — a progressão nunca atrasa a
// resposta, só preenche a espera quando ela existe.
const THINKING_DELAY_MS = 500;
const STATUS_PROGRESSION: { delayMs: number; status: VoiceModeStatus; label: string }[] = [
  { delayMs: 100, status: 'pensando', label: 'Ouvi você.' },
  { delayMs: 300, status: 'pensando', label: 'Entendi.' },
  { delayMs: 600, status: 'executando', label: 'Consultando seus dados...' },
  { delayMs: 1000, status: 'pensando', label: 'Pensando...' },
];

type VoiceModeStatus = 'ouvindo' | 'pensando' | 'executando' | 'respondendo' | 'pronto';

const ORB_STATUS_BY_VOICE_STATUS: Record<VoiceModeStatus, NovaOrbStatus> = {
  ouvindo: 'ouvindo',
  pensando: 'pensando',
  executando: 'executando',
  respondendo: 'respondendo',
  pronto: 'idle',
};

const STATUS_LABEL: Record<VoiceModeStatus, string> = {
  ouvindo: 'Ouvindo...',
  pensando: 'Pensando...',
  executando: 'Executando...',
  respondendo: 'Respondendo...',
  pronto: 'Pronto.',
};

const ORB_SCALE_BY_VOICE_STATUS: Record<VoiceModeStatus, number> = {
  ouvindo: 1.05,
  pensando: 1.1,
  executando: 1.16,
  respondendo: 1.16,
  pronto: 1,
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * NovaVoiceOverlay — Modo Conversa por voz (CONTROL OS — Etapa 8: NOVA Voice
 * Experience).
 *
 * "NOVA para de ser apenas um chat: conversa naturalmente." Tela quase
 * vazia, `NovaOrb` centralizada, legenda em tempo real abaixo — sem nenhum
 * elemento de navegação. Aberto pelo `NovaFloatingLauncher` em qualquer
 * módulo do sistema.
 *
 * Reaproveita exatamente a infraestrutura existente: `conversationService`
 * (o singleton compartilhado com a conversa por texto — a confirmação de uma
 * ação sensível nunca se mistura entre os dois canais, cada um com seu
 * `sessionId`), `useNovaContext` (mesmo contexto real da conversa por texto)
 * e os dois provedores de voz (`SpeechProvider`/`VoiceProvider`,
 * `services/voice`) — nenhuma regra de negócio nova aqui, só a superfície de
 * voz por cima do que já existe. Em particular, a confirmação de ações
 * sensíveis ("Confirma?" / usuário responde "sim"/"não" falando) já funciona
 * sem nenhum código extra: `ConversationService.processTurn` já reconhece
 * essas respostas curtas (`CONFIRM_PATTERN`/`CANCEL_PATTERN`, em
 * `services/ai/conversation/confirmation.ts`) quando há uma ação pendente na
 * sessão — o Modo Conversa só precisa continuar chamando `processTurn` a
 * cada fala do usuário, do mesmo jeito.
 *
 * CONTROL OS — Etapa 11: a percepção de velocidade ("nunca deixar a tela
 * parada") vem de `STATUS_PROGRESSION` — uma legenda evolui sozinha
 * ("Ouvi você." → "Entendi." → "Consultando seus dados..." → "Pensando...")
 * enquanto a chamada real corre em paralelo, e para assim que a resposta
 * de verdade chega. Nunca atrasa a resposta real; só preenche o silêncio
 * quando ele existiria.
 *
 * Interrupção (CONTROL OS — Etapa 8: "usuário pode interromper a NOVA"):
 * implementada como toque-pra-interromper — tocar a esfera enquanto a NOVA
 * fala cancela a fala e volta a ouvir imediatamente. Deliberadamente mais
 * simples que "ouvir continuamente enquanto fala" (que arriscaria eco/
 * feedback do microfone captando a própria voz da NOVA pelo alto-falante,
 * sem cancelamento de eco garantido pela Web Speech API do navegador) — é
 * uma simplificação consciente, não uma limitação escondida.
 */
export function NovaVoiceOverlay() {
  const open = useAppStore((state) => state.novaVoiceOpen);
  const setOpen = useAppStore((state) => state.setNovaVoiceOpen);
  // CONTROL OS — Etapa 15 (LEGENDARY): mesma persona escolhida na conversa
  // por texto (`NovaPersonaSwitch`, em `nova-workspace.tsx`) — o Modo
  // Conversa por voz é só outro canal do MESMO ecossistema, nunca uma
  // terceira identidade própria. Trocar de persona no chat também muda a
  // cor/comportamento da esfera e o System Prompt aqui, na próxima vez que
  // este overlay abrir ou falar.
  const activePersona = useAppStore((state) => state.activePersona);
  const novaContext = useNovaContext();
  // CONTROL OS — "separação completa entre NOVA e LEGENDARY": identidade do
  // overlay (rótulos, aria-labels) e isolamento da sessão de voz derivam da
  // persona ativa, não mais de "Nova" fixo.
  const isLegendary = activePersona === 'legendary';
  const personaLabel = isLegendary ? 'LEGENDARY' : 'Nova';
  const voiceSessionId = `${VOICE_SESSION_ID}_${activePersona}`;

  const [status, setStatus] = React.useState<VoiceModeStatus>('pronto');
  const [liveTranscript, setLiveTranscript] = React.useState('');
  const [novaReply, setNovaReply] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState<string | undefined>(undefined);
  /** Legenda da progressão "nunca em silêncio" (ver `STATUS_PROGRESSION`) — só existe entre o fim da fala e a resposta real chegar. */
  const [waitingLabel, setWaitingLabel] = React.useState<string | undefined>(undefined);
  /** Incrementa a cada fronteira de palavra reportada por `VoiceProvider.speak` — ver `NovaOrbProps.pulseSignal` (Etapa 11: "fala → pulsa conforme as palavras"). */
  const [speechPulse, setSpeechPulse] = React.useState(0);

  const speechSupported = React.useMemo(() => getSpeechProvider().isSupported, []);
  const voiceSupported = React.useMemo(() => getVoiceProvider().isSupported, []);

  // `startListening` e `handleFinalTranscript` se chamam mutuamente (ouvir →
  // transcrever → responder → voltar a ouvir) — um ciclo que um `useCallback`
  // não consegue expressar diretamente sem uma dependência circular (cada um
  // precisaria do outro na própria lista de dependências antes dele existir).
  // Esta ref quebra o ciclo: sempre aponta para a versão mais recente de
  // `startListening`, sem entrar na lista de dependências de
  // `handleFinalTranscript` (refs são estáveis por identidade).
  const startListeningRef = React.useRef<() => void>(() => undefined);

  const handleFinalTranscript = React.useCallback(
    (transcript: string) => {
      getSpeechProvider().stop();
      setLiveTranscript(transcript);
      setErrorMessage(undefined);

      void (async () => {
        // Orb reage em 0ms; a chamada real começa junto, em paralelo com a
        // progressão de legendas — nenhuma delas espera a outra.
        setStatus('pensando');
        setWaitingLabel(undefined);
        const timers = STATUS_PROGRESSION.map(({ delayMs, status: stepStatus, label }) =>
          window.setTimeout(() => {
            setStatus(stepStatus);
            setWaitingLabel(label);
          }, delayMs)
        );

        const result = await conversationService.processTurn(transcript, novaContext, voiceSessionId, activePersona);
        timers.forEach((id) => window.clearTimeout(id));
        setWaitingLabel(undefined);
        setNovaReply(result.reply);
        setStatus('respondendo');

        if (!voiceSupported) {
          // Sem síntese de voz disponível — mostra a legenda por um
          // instante e volta a ouvir, em vez de travar em "Respondendo...".
          await wait(THINKING_DELAY_MS);
          setStatus('ouvindo');
          startListeningRef.current();
          return;
        }

        getVoiceProvider().speak(result.reply, {
          persona: activePersona,
          onBoundary: () => setSpeechPulse((tick) => tick + 1),
          onEnd: () => {
            setStatus('ouvindo');
            startListeningRef.current();
          },
          onError: (message) => {
            setErrorMessage(message);
            setStatus('ouvindo');
            startListeningRef.current();
          },
        });
      })();
    },
    [novaContext, voiceSupported, activePersona, voiceSessionId]
  );

  const startListening = React.useCallback(() => {
    if (!speechSupported) {
      setErrorMessage(
        `Este navegador não suporta reconhecimento de voz. Você ainda pode conversar por texto em ${
          isLegendary ? '/legendary' : '/nova'
        }.`
      );
      setStatus('pronto');
      return;
    }
    setErrorMessage(undefined);
    setLiveTranscript('');
    setStatus('ouvindo');
    getSpeechProvider().start({
      onResult: (result) => {
        setLiveTranscript(result.transcript);
        if (result.isFinal && result.transcript.trim().length > 0) {
          handleFinalTranscript(result.transcript.trim());
        }
      },
      onError: (message) => {
        setErrorMessage(message);
        setStatus('pronto');
      },
      onEnd: () => {
        setStatus((prev) => (prev === 'ouvindo' ? 'pronto' : prev));
      },
    });
  }, [speechSupported, handleFinalTranscript, isLegendary]);

  startListeningRef.current = startListening;

  // Abre pronto para o gesto de segurar e falar. Fecha (ou desmonta) →
  // sempre libera o microfone e cancela qualquer fala
  // em andamento, nunca deixa nenhum dos dois rodando em segundo plano.
  // Roda só quando `open` muda (não a cada re-render por causa de
  // `startListening` mudar de identidade quando os dados do usuário mudam) —
  // usar `startListeningRef.current()` dentro do efeito, em vez de chamar
  // `startListening` direto, já bastaria para pegar a versão mais recente,
  // mas o efeito em si só deve disparar na abertura/fechamento.
  React.useEffect(() => {
    if (!open) return undefined;
    setNovaReply('');
    setStatus('pronto');
    return () => {
      getSpeechProvider().stop();
      getVoiceProvider().cancel();
    };
  }, [open]);

  const handleClose = React.useCallback(() => {
    getSpeechProvider().stop();
    getVoiceProvider().cancel();
    setOpen(false);
  }, [setOpen]);

  const toggleVoiceCapture = React.useCallback(() => {
    if (status === 'respondendo') {
      getVoiceProvider().cancel();
      startListening();
      return;
    }
    if (status === 'ouvindo') {
      getSpeechProvider().stop();
      setStatus('pensando');
      setWaitingLabel('Transcrevendo seu áudio...');
      return;
    }
    if (status === 'pronto') {
      getVoiceProvider().unlock();
      startListening();
    }
  }, [status, startListening]);

  const caption =
    status === 'ouvindo'
      ? liveTranscript || 'Pode falar.'
      : status === 'respondendo'
        ? novaReply || '...'
        : status === 'pensando' || status === 'executando'
          ? waitingLabel || 'Ouvi você.'
          : liveTranscript;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col bg-bg/80 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          role="dialog"
          aria-modal="true"
          aria-label={`Modo Conversa com a ${personaLabel}`}
        >
          <div className="flex justify-end p-4 sm:p-6">
            <button
              type="button"
              onClick={handleClose}
              aria-label="Fechar Modo Conversa"
              className="flex h-10 w-10 items-center justify-center rounded-full text-text-tertiary transition-colors duration-fast ease-out hover:bg-white/[0.06] hover:text-text-primary"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-16">
            <motion.button
              type="button"
              onClick={toggleVoiceCapture}
              aria-label={
                status === 'respondendo'
                  ? `Toque para interromper e falar com a ${personaLabel}`
                  : status === 'ouvindo'
                    ? 'Toque para encerrar e enviar sua fala'
                    : `Toque para falar com a ${personaLabel}`
              }
              className="flex h-56 w-56 items-center justify-center rounded-full sm:h-64 sm:w-64"
              animate={{ scale: ORB_SCALE_BY_VOICE_STATUS[status] }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
            >
              <NovaOrb status={ORB_STATUS_BY_VOICE_STATUS[status]} pulseSignal={speechPulse} persona={activePersona} />
            </motion.button>

            <div className="flex max-w-md flex-col items-center gap-2 text-center">
              <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
                {STATUS_LABEL[status]}
              </span>
              {errorMessage ? (
                <p className="text-sm text-accent-red">{errorMessage}</p>
              ) : (
                <p className="text-base text-text-primary">{status === 'pronto' ? 'Segure para falar.' : caption}</p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
