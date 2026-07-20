import type { VoiceProvider, VoiceProviderHandlers } from './types';

/**
 * Stub do futuro `VoiceProvider` via OpenAI Text-to-Speech (CONTROL OS —
 * Etapa 11: "preparar a arquitetura para futura substituição por OpenAI TTS
 * ou outro provedor premium, mantendo a interface atual"). Implementa a
 * MESMA interface que `BrowserVoiceProvider` — nenhum componente de UI
 * (`nova-voice-overlay.tsx`) precisaria mudar uma linha quando este provedor
 * virar o padrão.
 *
 * Deliberadamente NÃO ativado ainda (não está em `services/voice/config.ts`)
 * — ativar exigiria: (1) uma Route Handler server-side própria (mesmo
 * padrão de `app/api/ai/nova/route.ts`) pra manter `OPENAI_API_KEY` fora do
 * cliente, já que síntese de fala real custa uma chamada de API paga; (2)
 * tocar áudio recebido (`<audio>`/`AudioContext`) em vez de
 * `SpeechSynthesis`. Nenhuma das duas coisas está implementada aqui — é só o
 * contorno da classe, pronta pra ganhar corpo quando a etapa de voz premium
 * for priorizada. Para ativar então: implementar o corpo abaixo, estender
 * `VoiceProviderName` em `config.ts` com `'openai'`, e trocar
 * `getVoiceProvider()` pra instanciar esta classe quando
 * `NEXT_PUBLIC_VOICE_PROVIDER === 'openai'`.
 */
export class OpenAITTSVoiceProvider implements VoiceProvider {
  get isSupported(): boolean {
    // Sempre `false` enquanto não implementado — nunca reivindica suporte
    // que não tem de verdade.
    return false;
  }

  speak(_text: string, handlers?: VoiceProviderHandlers): void {
    handlers?.onError?.('Voz premium (OpenAI TTS) ainda não está disponível nesta versão.');
  }

  cancel(): void {
    // Nada a cancelar — nenhuma síntese real acontece ainda.
  }

  unlock(): void {
    // Nada a destravar — `isSupported` é sempre `false`, nenhum áudio real
    // chega a tocar. Existe só pra satisfazer `VoiceProvider` (ver
    // `types.ts`) — quando este provedor ganhar corpo de verdade, o
    // destravamento real (provavelmente de um `<audio>`/`AudioContext`, não
    // mais `SpeechSynthesis`) entra aqui.
  }
}
