import { OpenAITranscriptionProvider } from './OpenAITranscriptionProvider';
import { WebSpeechProvider } from './WebSpeechProvider';
import type { SpeechProvider, SpeechProviderHandlers } from './types';

/** Usa reconhecimento nativo quando existe e transcrição OpenAI como fallback. */
export class HybridSpeechProvider implements SpeechProvider {
  private readonly browser = new WebSpeechProvider();
  private readonly openai = new OpenAITranscriptionProvider();

  get isSupported(): boolean {
    return this.browser.isSupported || this.openai.isSupported;
  }

  start(handlers: SpeechProviderHandlers): void {
    if (this.browser.isSupported) {
      this.browser.start(handlers);
      return;
    }
    this.openai.start(handlers);
  }

  stop(): void {
    this.browser.stop();
    this.openai.stop();
  }
}
