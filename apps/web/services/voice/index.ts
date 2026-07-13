/**
 * Barrel do serviço de voz da NOVA (CONTROL OS — Etapa 8). Componentes de UI
 * devem importar só daqui — nunca diretamente de `WebSpeechProvider`/
 * `BrowserVoiceProvider` — para que trocar de provedor no futuro não exija
 * mudar nenhum import em componente.
 */
export { getSpeechProvider, getVoiceProvider, SPEECH_PROVIDER, VOICE_PROVIDER } from './config';
export type {
  SpeechProvider,
  SpeechProviderHandlers,
  SpeechRecognitionResultPayload,
  VoiceProvider,
  VoiceProviderHandlers,
} from './types';
