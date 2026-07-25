import { getVoicePreference } from './voice-preferences';
import type { VoiceProvider, VoiceProviderHandlers } from './types';

/**
 * Síntese premium via OpenAI, sempre por uma rota do servidor: a chave nunca
 * é enviada para o navegador. Nunca mistura com a voz do navegador: uma
 * resposta deve ter uma única voz, não duas falando ao mesmo tempo.
 */
export class OpenAITTSVoiceProvider implements VoiceProvider {
  private audio: HTMLAudioElement | undefined;
  private objectUrl: string | undefined;
  private requestId = 0;
  private unlocked = false;

  // Pequeno WAV silencioso. Ele é tocado dentro do primeiro toque real do
  // usuário para liberar áudio posterior no Safari/iPhone; sem isto, o MP3
  // que chega depois do `fetch` pode ser bloqueado como autoplay.
  private static readonly SILENT_AUDIO = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQIAAAAAAA==';

  get isSupported(): boolean {
    return typeof window !== 'undefined' && typeof Audio !== 'undefined';
  }

  speak(text: string, handlers?: VoiceProviderHandlers): void {
    this.cancel();
    const requestId = ++this.requestId;
    void this.play(text, handlers, requestId);
  }

  cancel(): void {
    this.requestId += 1;
    this.audio?.pause();
    this.audio = undefined;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = undefined;
  }

  unlock(): void {
    if (this.unlocked || !this.isSupported) return;
    const primer = new Audio(OpenAITTSVoiceProvider.SILENT_AUDIO);
    primer.volume = 0;
    // Não usamos SpeechSynthesis como primer: isso evitaria o problema do
    // Safari, mas criaria a sensação de duas vozes em alguns navegadores.
    void primer.play().then(() => {
      primer.pause();
      primer.removeAttribute('src');
      primer.load();
      this.unlocked = true;
    }).catch(() => {
      // Se o navegador não aceitar o primer, a chamada real ainda tenta
      // tocar e devolve uma mensagem específica ao usuário.
    });
  }

  private async play(text: string, handlers: VoiceProviderHandlers | undefined, requestId: number): Promise<void> {
    try {
      const response = await fetch('/api/voice/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          persona: handlers?.persona ?? 'nova',
          voice: getVoicePreference(handlers?.persona ?? 'nova'),
        }),
      });
      if (!response.ok) {
        const data: unknown = await response.json().catch(() => undefined);
        const message = typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string'
          ? data.message
          : 'A voz premium está indisponível agora.';
        throw new Error(message);
      }

      const audioBlob = await response.blob();
      if (requestId !== this.requestId) return;
      this.objectUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(this.objectUrl);
      this.audio = audio;
      let lastPulseAt = 0;
      const pulse = () => {
        const now = performance.now();
        if (now - lastPulseAt < 220) return;
        lastPulseAt = now;
        handlers?.onBoundary?.();
      };
      audio.onplay = pulse;
      audio.ontimeupdate = pulse;
      audio.onended = () => {
        if (requestId !== this.requestId) return;
        this.clearAudio();
        handlers?.onEnd?.();
      };
      audio.onerror = () => {
        if (requestId !== this.requestId) return;
        this.clearAudio();
        handlers?.onError?.('O navegador não conseguiu reproduzir a voz. Toque no botão de microfone uma vez e tente novamente.');
      };
      await audio.play();
    } catch (error) {
      if (requestId !== this.requestId) return;
      this.clearAudio();
      const message = error instanceof Error ? error.message : 'Não foi possível tocar a voz agora.';
      handlers?.onError?.(message);
    }
  }

  private clearAudio(): void {
    this.audio = undefined;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = undefined;
  }
}
