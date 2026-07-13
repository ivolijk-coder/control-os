import { BrowserVoiceProvider } from './BrowserVoiceProvider';
import type { SpeechProvider, VoiceProvider } from './types';
import { WebSpeechProvider } from './WebSpeechProvider';

/**
 * Ponto único de configuração de quais provedores de voz a NOVA usa
 * (CONTROL OS — Etapa 8), espelhando exatamente o padrão já usado em
 * `services/ai/config.ts` (`getAIProvider`) — mesmo shape, mesma ideia:
 * uma variável de ambiente `NEXT_PUBLIC_...` escolhe a implementação, e o
 * resto do sistema só conhece a interface (`SpeechProvider`/`VoiceProvider`),
 * nunca a classe concreta.
 *
 * Hoje só existe um provedor de cada lado (`WebSpeechProvider`/
 * `BrowserVoiceProvider`, ambos via Web APIs nativas do navegador) — as
 * variáveis já existem e já têm valor padrão `'browser'` para que trocar por
 * um provedor melhor no futuro (OpenAI Speech-to-Text/Whisper/Deepgram/
 * AssemblyAI; OpenAI Text-to-Speech/ElevenLabs/Azure/Google) seja só
 * adicionar a nova classe aqui, sem tocar em nenhum componente de UI.
 */
type SpeechProviderName = 'browser';
type VoiceProviderName = 'browser';

// Hoje só existe o valor `'browser'` de cada lado, então não há nada pra
// decidir a partir de `NEXT_PUBLIC_SPEECH_PROVIDER`/`NEXT_PUBLIC_VOICE_PROVIDER`
// ainda — as variáveis já estão documentadas (ver `.env.local.example`) e
// reservadas: quando um segundo provedor for adicionado (ex.: `'openai'`),
// basta estender os tipos acima e ler `process.env.NEXT_PUBLIC_SPEECH_PROVIDER`
// aqui, sem tocar em nenhum outro arquivo que consome
// `getSpeechProvider`/`getVoiceProvider`.
export const SPEECH_PROVIDER: SpeechProviderName = 'browser';
export const VOICE_PROVIDER: VoiceProviderName = 'browser';

let cachedSpeechProvider: SpeechProvider | undefined;
let cachedVoiceProvider: VoiceProvider | undefined;

/** Fábrica do `SpeechProvider` ativo — cacheia a instância (mesmo padrão de `getAIProvider`). */
export function getSpeechProvider(): SpeechProvider {
  if (!cachedSpeechProvider) {
    cachedSpeechProvider = new WebSpeechProvider();
  }
  return cachedSpeechProvider;
}

/** Fábrica do `VoiceProvider` ativo — cacheia a instância (mesmo padrão de `getAIProvider`). */
export function getVoiceProvider(): VoiceProvider {
  if (!cachedVoiceProvider) {
    cachedVoiceProvider = new BrowserVoiceProvider();
  }
  return cachedVoiceProvider;
}
