import type { VoiceProvider, VoiceProviderHandlers } from './types';

/** Prefixo do idioma que preferimos pra escolher uma voz instalada no navegador — nem todo navegador tem uma voz pt-BR exata. */
const PREFERRED_LANG_PREFIX = 'pt';

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return (
    voices.find((voice) => voice.lang.toLowerCase() === 'pt-br') ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(PREFERRED_LANG_PREFIX))
  );
}

/**
 * `VoiceProvider` real via `SpeechSynthesis` do navegador (CONTROL OS —
 * Etapa 8). "Utilizar inicialmente SpeechSynthesis" — implementação de
 * referência; nenhum outro arquivo além deste conhece
 * `speechSynthesis`/`SpeechSynthesisUtterance`. Diferente do STT, a TTS do
 * navegador É padronizada no `lib.dom.d.ts` — sem necessidade de declarar
 * tipos próprios aqui.
 */
export class BrowserVoiceProvider implements VoiceProvider {
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
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    const voice = pickVoice(window.speechSynthesis.getVoices());
    if (voice) utterance.voice = voice;

    utterance.onend = () => handlers?.onEnd?.();
    utterance.onerror = () => handlers?.onError?.('Não consegui falar a resposta agora.');

    window.speechSynthesis.speak(utterance);
  }

  cancel(): void {
    if (!this.isSupported) return;
    window.speechSynthesis.cancel();
  }
}
