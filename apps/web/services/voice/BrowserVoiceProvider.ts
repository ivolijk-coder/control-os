import type { VoiceProvider, VoiceProviderHandlers } from './types';

/** Prefixo do idioma que preferimos pra escolher uma voz instalada no navegador — nem todo navegador tem uma voz pt-BR exata. */
const PREFERRED_LANG_PREFIX = 'pt';

/**
 * Ritmo (CONTROL OS — Etapa 11: "evoluir o VoiceProvider... melhorar ritmo,
 * pausas, velocidade, naturalidade"). `SpeechSynthesis` não aceita SSML, e o
 * padrão do navegador (`rate: 1`) soa apressado e monótono, sem pausa real
 * entre frases — lê tudo como um bloco só. Duas mudanças, sem trocar de
 * provedor: (1) uma taxa levemente abaixo do padrão dá tempo da fala
 * "respirar"; (2) falar frase por frase (`splitIntoSentences`), com uma
 * pausa curta entre cada `SpeechSynthesisUtterance`, em vez de uma
 * utterance gigante — é a única forma de inserir pausa real nesta API.
 */
const SPEECH_RATE = 0.96;
const SPEECH_PITCH = 1.0;
const PAUSE_BETWEEN_SENTENCES_MS = 140;

/** Quebra em frases por pontuação forte (. ! ? ; ou quebra de linha), preservando o separador — nunca corta no meio de uma frase. */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?;\n])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return (
    voices.find((voice) => voice.lang.toLowerCase() === 'pt-br') ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(PREFERRED_LANG_PREFIX))
  );
}

/**
 * `VoiceProvider` real via `SpeechSynthesis` do navegador (CONTROL OS —
 * Etapa 8; ritmo/pausas refinados na Etapa 11). "Utilizar inicialmente
 * SpeechSynthesis" — implementação de referência; nenhum outro arquivo além
 * deste conhece `speechSynthesis`/`SpeechSynthesisUtterance`. Diferente do
 * STT, a TTS do navegador É padronizada no `lib.dom.d.ts` — sem necessidade
 * de declarar tipos próprios aqui.
 *
 * Preparado pra troca futura por OpenAI TTS (ou outro provedor premium) sem
 * mudar nenhum consumidor: a interface pública (`speak`/`cancel`/
 * `isSupported`) já é a mesma que qualquer outro `VoiceProvider` precisa
 * implementar — ver `services/voice/OpenAITTSVoiceProvider.ts` (stub) e
 * `services/voice/config.ts` (fábrica) pra como ativar quando o momento
 * chegar.
 */
export class BrowserVoiceProvider implements VoiceProvider {
  private queue: string[] = [];
  private activeHandlers: VoiceProviderHandlers | undefined;
  private voice: SpeechSynthesisVoice | undefined;

  get isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  speak(text: string, handlers?: VoiceProviderHandlers): void {
    if (!this.isSupported) {
      handlers?.onError?.('Este navegador não suporta voz falada.');
      return;
    }

    // Cancela qualquer fala em andamento antes de começar a nova — nunca
    // duas falas sobrepostas (ex.: usuário interrompe e a NOVA já tem uma
    // resposta nova pronta).
    this.cancel();

    this.queue = splitIntoSentences(text);
    this.activeHandlers = handlers;
    this.voice = pickVoice(window.speechSynthesis.getVoices());

    if (this.queue.length === 0) {
      handlers?.onEnd?.();
      return;
    }

    this.speakNext();
  }

  private speakNext(): void {
    const sentence = this.queue.shift();
    if (!sentence) {
      this.activeHandlers?.onEnd?.();
      this.activeHandlers = undefined;
      return;
    }

    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = 'pt-BR';
    utterance.rate = SPEECH_RATE;
    utterance.pitch = SPEECH_PITCH;
    if (this.voice) utterance.voice = this.voice;

    // `onboundary` dispara por palavra (em navegadores que suportam —
    // Chrome/Edge; outros simplesmente nunca disparam, e o consumidor trata
    // a ausência como normal, ver `VoiceProviderHandlers.onBoundary`).
    utterance.onboundary = () => this.activeHandlers?.onBoundary?.();

    utterance.onerror = () => {
      this.queue = [];
      this.activeHandlers?.onError?.('Não consegui falar a resposta agora.');
      this.activeHandlers = undefined;
    };

    utterance.onend = () => {
      if (this.queue.length === 0) {
        this.activeHandlers?.onEnd?.();
        this.activeHandlers = undefined;
        return;
      }
      // Pausa curta entre frases — a única forma de dar "respiro" real numa
      // API sem suporte a SSML/marcação de prosódia.
      window.setTimeout(() => this.speakNext(), PAUSE_BETWEEN_SENTENCES_MS);
    };

    window.speechSynthesis.speak(utterance);
  }

  cancel(): void {
    this.queue = [];
    this.activeHandlers = undefined;
    if (!this.isSupported) return;
    window.speechSynthesis.cancel();
  }
}
