import { getVoicePreference } from './voice-preferences';
import type { VoiceProvider, VoiceProviderHandlers } from './types';

/**
 * Síntese premium via OpenAI, sempre por uma rota do servidor: a chave nunca
 * é enviada para o navegador. Se a API não estiver disponível, a conversa
 * continua pela voz nativa do navegador recebida como fallback.
 */
export class OpenAITTSVoiceProvider implements VoiceProvider {
  private audio: HTMLAudioElement | undefined;
  private objectUrl: string | undefined;
  private requestId = 0;

  constructor(private readonly fallback: VoiceProvider) {}

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
    this.fallback.cancel();
  }

  unlock(): void {
    this.fallback.unlock();
  }

  private async play(text: string, handlers: VoiceProviderHandlers | undefined, requestId: number): Promise<void> {
    try {
      const response = await fetch('/api/voice/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: getVoicePreference(handlers?.persona ?? 'nova') }),
      });
      if (!response.ok) throw new Error('Voz premium indisponível.');

      const audioBlob = await response.blob();
      if (requestId !== this.requestId) return;
      this.objectUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(this.objectUrl);
      this.audio = audio;
      audio.onended = () => {
        if (requestId !== this.requestId) return;
        this.clearAudio();
        handlers?.onEnd?.();
      };
      audio.onerror = () => {
        if (requestId !== this.requestId) return;
        this.clearAudio();
        this.fallback.speak(text, handlers);
      };
      await audio.play();
    } catch {
      if (requestId !== this.requestId) return;
      this.clearAudio();
      this.fallback.speak(text, handlers);
    }
  }

  private clearAudio(): void {
    this.audio = undefined;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = undefined;
  }
}
