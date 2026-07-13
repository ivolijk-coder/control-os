import type { SpeechProvider, SpeechProviderHandlers } from './types';

/**
 * A Web Speech API de reconhecimento de fala (`SpeechRecognition`) não é
 * padronizada no TypeScript (só existe prefixada, `webkitSpeechRecognition`,
 * na maioria dos navegadores) — o `lib.dom.d.ts` do TypeScript já declara
 * `SpeechRecognitionResult`/`SpeechRecognitionResultList` (usados abaixo),
 * mas não a interface principal nem o construtor em `Window`. Declarados
 * aqui, com nomes próprios (`Nova...`) pra nunca colidir com uma futura
 * declaração padrão da lib — zero `any`, zero cast.
 */
interface NovaSpeechRecognitionResultEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface NovaSpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

interface NovaSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: NovaSpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: NovaSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => NovaSpeechRecognition;
    webkitSpeechRecognition?: new () => NovaSpeechRecognition;
  }
}

/** Mensagens amigáveis por código de erro da Web Speech API — nunca expõe o código cru na UI. */
const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Preciso de permissão pra usar o microfone.',
  'no-speech': 'Não ouvi nada. Pode falar de novo?',
  network: 'Sem conexão suficiente pra reconhecer a fala agora.',
  aborted: 'A escuta foi interrompida.',
};

function friendlyErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? 'Não consegui entender o áudio. Pode tentar de novo?';
}

function getRecognitionConstructor(): (new () => NovaSpeechRecognition) | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

/**
 * `SpeechProvider` real via Web Speech API do navegador (CONTROL OS —
 * Etapa 8). "Utilizar inicialmente a Web Speech API" — implementação de
 * referência; nenhum outro arquivo além deste conhece `SpeechRecognition`.
 */
export class WebSpeechProvider implements SpeechProvider {
  private recognition: NovaSpeechRecognition | undefined;

  get isSupported(): boolean {
    return getRecognitionConstructor() !== undefined;
  }

  start(handlers: SpeechProviderHandlers): void {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      handlers.onError?.('Este navegador não suporta reconhecimento de voz.');
      return;
    }

    // Chamar `start()` de novo enquanto já está ouvindo lança erro na API
    // nativa — para a instância anterior primeiro, sempre seguro mesmo se
    // já tiver parado sozinha.
    this.stop();

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';

    recognition.onresult = (event) => {
      // `resultIndex` aponta pro primeiro resultado NOVO desde o último
      // evento — junta tudo a partir dali numa única transcrição corrente,
      // como a maioria das UIs de ditado faz.
      let transcript = '';
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        const alternative = result[0];
        if (!alternative) continue;
        transcript += alternative.transcript;
        if (result.isFinal) isFinal = true;
      }
      if (transcript.trim().length > 0) {
        handlers.onResult({ transcript: transcript.trim(), isFinal });
      }
    };

    recognition.onerror = (event) => {
      handlers.onError?.(friendlyErrorMessage(event.error));
    };

    recognition.onend = () => {
      handlers.onEnd?.();
    };

    this.recognition = recognition;
    recognition.start();
  }

  stop(): void {
    if (!this.recognition) return;
    // `onend` já cuida de notificar o chamador — só para a captura aqui.
    this.recognition.onend = null;
    this.recognition.stop();
    this.recognition = undefined;
  }
}
