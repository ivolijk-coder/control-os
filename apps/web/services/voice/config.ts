import { BrowserVoiceProvider } from './BrowserVoiceProvider';
import { HybridSpeechProvider } from './HybridSpeechProvider';
import { OpenAITTSVoiceProvider } from './OpenAITTSVoiceProvider';
import type { SpeechProvider, VoiceProvider } from './types';

/**
 * Configuração única de áudio. A captura é híbrida: Web Speech onde o
 * navegador suporta, transcrição OpenAI onde ele não suporta (Firefox).
 * A resposta usa voz premium e recorre à voz do sistema se necessário.
 */
export const SPEECH_PROVIDER = 'hybrid' as const;
export const VOICE_PROVIDER = 'openai' as const;

let cachedSpeechProvider: SpeechProvider | undefined;
let cachedVoiceProvider: VoiceProvider | undefined;

export function getSpeechProvider(): SpeechProvider {
  if (!cachedSpeechProvider) cachedSpeechProvider = new HybridSpeechProvider();
  return cachedSpeechProvider;
}

export function getVoiceProvider(): VoiceProvider {
  if (!cachedVoiceProvider) cachedVoiceProvider = new OpenAITTSVoiceProvider(new BrowserVoiceProvider());
  return cachedVoiceProvider;
}
