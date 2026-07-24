import type { SpeechProvider, SpeechProviderHandlers } from './types';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

function recorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
    .find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * Transcrição via OpenAI para navegadores sem Web Speech API, como Firefox.
 * A gravação termina quando a pessoa toca novamente no microfone.
 */
export class OpenAITranscriptionProvider implements SpeechProvider {
  private recorder: MediaRecorder | undefined;
  private stream: MediaStream | undefined;
  private captureId = 0;

  get isSupported(): boolean {
    return typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';
  }

  start(handlers: SpeechProviderHandlers): void {
    this.stop();
    const captureId = ++this.captureId;
    void this.beginCapture(captureId, handlers);
  }

  private async beginCapture(captureId: number, handlers: SpeechProviderHandlers): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (captureId !== this.captureId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      this.stream = stream;
      const mimeType = recorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => handlers.onError?.('Não consegui gravar seu áudio. Tente novamente.');
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (this.recorder === recorder) this.recorder = undefined;
        if (this.stream === stream) this.stream = undefined;
        void this.transcribe(captureId, chunks, recorder.mimeType || mimeType || 'audio/webm', handlers);
      };

      this.recorder = recorder;
      recorder.start();
    } catch {
      handlers.onError?.('Preciso de permissão para usar o microfone.');
      handlers.onEnd?.();
    }
  }

  private async transcribe(captureId: number, chunks: BlobPart[], mimeType: string, handlers: SpeechProviderHandlers): Promise<void> {
    const audio = new Blob(chunks, { type: mimeType });
    if (audio.size === 0) {
      handlers.onError?.('Não ouvi nada. Pode falar de novo?');
      handlers.onEnd?.();
      return;
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      handlers.onError?.('O áudio ficou longo demais. Tente uma mensagem mais curta.');
      handlers.onEnd?.();
      return;
    }

    try {
      const formData = new FormData();
      formData.set('audio', audio, mimeType.includes('mp4') ? 'mensagem.m4a' : 'mensagem.webm');
      const response = await fetch('/api/voice/transcribe', { method: 'POST', body: formData });
      const data: unknown = await response.json().catch(() => undefined);
      if (!response.ok || typeof data !== 'object' || data === null || !('text' in data) || typeof data.text !== 'string') {
        const message = typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string'
          ? data.message
          : 'Não consegui transcrever o áudio agora.';
        throw new Error(message);
      }
      if (captureId === this.captureId && data.text.trim()) {
        handlers.onResult({ transcript: data.text.trim(), isFinal: true });
      }
    } catch (error) {
      handlers.onError?.(error instanceof Error ? error.message : 'Não consegui transcrever o áudio agora.');
    } finally {
      handlers.onEnd?.();
    }
  }

  stop(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop();
      return;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
  }
}
