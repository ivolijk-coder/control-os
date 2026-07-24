import { OpenAITranscriptionProvider } from './OpenAITranscriptionProvider';
import { WebSpeechProvider } from './WebSpeechProvider';
import type { SpeechProvider, SpeechProviderHandlers } from './types';

/**
 * Prioriza uma gravação curta + transcrição no servidor. Assim a experiência
 * é igual em Chrome, Safari e Firefox: segure para falar e solte para enviar.
 * Web Speech permanece apenas como última alternativa quando não há gravador.
 */
export class HybridSpeechProvider implements SpeechProvider {
  private readonly browser = new WebSpeechProvider();
  private readonly openai = new OpenAITranscriptionProvider();

  get isSupported(): boolean {
    return this.browser.isSupported || this.openai.isSupported;
  }

  start(handlers: SpeechProviderHandlers): void {
    if (this.openai.isSupported) {
      this.openai.start(handlers);
      return;
    }
    this.browser.start(handlers);
  }

  stop(): void {
    this.browser.stop();
    this.openai.stop();
  }
}
