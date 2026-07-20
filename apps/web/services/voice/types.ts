/**
 * Contratos de voz do CONTROL OS (Etapa 8 — NOVA Voice Experience). Duas
 * interfaces, cada uma cobrindo metade da experiência de voz:
 *
 * `SpeechProvider` — capta a voz do usuário e devolve texto (Speech-to-Text).
 * `VoiceProvider` — fala a resposta da NOVA em voz alta (Text-to-Speech).
 *
 * Nenhum componente de UI (`nova-voice-overlay.tsx` etc.) ou o
 * `ConversationService` conhece a Web Speech API diretamente — todos
 * dependem só destas interfaces. Trocar a implementação por um provedor
 * melhor (OpenAI Speech-to-Text/Whisper/Deepgram/AssemblyAI pro STT; OpenAI
 * Text-to-Speech/ElevenLabs/Azure/Google pro TTS) no futuro é escrever uma
 * nova classe que implemente a mesma interface e trocar a fábrica em
 * `services/voice/config.ts` — nenhum outro arquivo muda.
 */

/** Um resultado de reconhecimento de fala — parcial (`isFinal: false`, ainda mudando) ou definitivo. */
export interface SpeechRecognitionResultPayload {
  transcript: string;
  isFinal: boolean;
}

export interface SpeechProviderHandlers {
  /** Chamado a cada atualização de transcrição — parcial (legenda ao vivo) ou final (dispara o turno da conversa). */
  onResult: (result: SpeechRecognitionResultPayload) => void;
  /** Erro de captura (permissão negada, sem microfone, rede etc.) — mensagem já amigável, pronta pra exibir. */
  onError?: (message: string) => void;
  /** A captura parou (usuário parou de falar, ou `stop()` foi chamado) — nunca chamado depois de um `onError`. */
  onEnd?: () => void;
}

export interface SpeechProvider {
  /** `false` quando o navegador/ambiente não suporta captura de voz (ex.: Safari sem o prefixo webkit, SSR). Quem consome deve checar antes de chamar `start`. */
  readonly isSupported: boolean;
  /** Começa a ouvir. Chamar de novo enquanto já está ouvindo é seguro — reinicia a captura. */
  start(handlers: SpeechProviderHandlers): void;
  /** Para de ouvir. Seguro chamar mesmo se não estiver ouvindo. */
  stop(): void;
}

export interface VoiceProviderHandlers {
  onEnd?: () => void;
  onError?: (message: string) => void;
  /**
   * Chamado a cada fronteira de palavra/frase durante a fala (CONTROL OS —
   * Etapa 11: "fala → pulsa conforme as palavras"). Opcional — nem todo
   * `VoiceProvider` consegue emitir isso com granularidade real (depende do
   * evento `onboundary` do `SpeechSynthesisUtterance`, ou do equivalente de
   * um provedor futuro); quem consome trata a ausência como "sem pulso
   * sincronizado", nunca como erro.
   */
  onBoundary?: () => void;
}

export interface VoiceProvider {
  /** `false` quando o navegador/ambiente não suporta síntese de voz. */
  readonly isSupported: boolean;
  /** Fala o texto em voz alta. Cancela qualquer fala em andamento antes de começar a nova. */
  speak(text: string, handlers?: VoiceProviderHandlers): void;
  /** Interrompe a fala atual imediatamente — usado quando o usuário interrompe a NOVA. */
  cancel(): void;
  /**
   * "Destrava" a síntese de voz pro resto da sessão (bug de mobile — Safari
   * iOS/Chrome Android). Quem chama `speak()` primeiro é sempre a resposta
   * da IA chegando DEPOIS de um round-trip assíncrono (`await
   * conversationService.processTurn(...)`) — nunca dentro do mesmo clique
   * síncrono do usuário. No desktop isso não importa; no Safari iOS (e, por
   * segurança, também no Chrome Android) a política de autoplay de áudio
   * exige que a PRIMEIRA chamada de síntese de voz da sessão aconteça
   * dentro da pilha síncrona de um gesto real do usuário — depois de um
   * `await`, o navegador já não considera mais isso um gesto, e `speak()`
   * falha em silêncio (nenhum som, nenhum `onerror`). `unlock()` deve ser
   * chamado de dentro do handler de clique síncrono que INICIA o fluxo de
   * voz (tocar o microfone, tocar a Orb) — antes de qualquer `await` — pra
   * "acordar" o motor de fala enquanto o gesto ainda é válido. Barato e
   * idempotente: seguro chamar em todo clique, não só uma vez por sessão.
   */
  unlock(): void;
}
