import type { ChannelAdapter, HubMessage } from '@/services/control-hub';

/**
 * Adapter do canal Web Chat — CONTROL HUB (Fase 8: Gateway Omnichannel).
 *
 * Diferente do WhatsApp (canal sem nenhuma integração real ainda), o
 * canal web JÁ está em produção: hoje `NovaWorkspace` chama
 * `ConversationService.processTurn` diretamente (via `services/nova`/
 * `services/ai`), fora do CONTROL HUB — ver a nota em
 * `control-hub.service.ts`/`context-manager.ts` sobre por quê. Migrar
 * essa chamada real para passar por este adapter é uma mudança na UI em
 * produção, deliberadamente FORA do escopo desta fase ("quero apenas
 * construir toda a infraestrutura necessária"). Este arquivo existe para
 * que a infraestrutura omnichannel (Channel Registry, Channel Gateway,
 * testes de paridade) tenha HOJE um segundo canal real e concreto para
 * comparar contra o WhatsApp — exatamente como pedido ("Hoje: Web Chat,
 * WhatsApp Mock").
 *
 * `toHubMessage`/`sendMessage` aqui são um MOCK no mesmo sentido que o
 * WhatsApp: nenhuma chamada real ao `NovaWorkspace`/`ConversationService`
 * acontece a partir deste adapter ainda. Quando a migração da UI
 * acontecer (fase futura), a forma de `InboundWebChatMessage` já é bem
 * próxima da realidade (texto + identificador de sessão/usuário) — só o
 * transporte muda (de "chamada direta" para "via este adapter").
 */

export interface InboundWebChatMessage {
  /** Identificador de sessão/usuário do Web Chat (hoje: um id mock; na migração real, o id do usuário autenticado). */
  sessionId: string;
  text: string;
  /** Timestamp ISO de recebimento. */
  receivedAt: string;
}

export interface OutboundWebChatMessage {
  sessionId: string;
  text: string;
}

export interface WebChannelAdapter extends ChannelAdapter<InboundWebChatMessage> {
  readonly channel: 'web';
}

/**
 * Outbox em memória do mock — mesmo propósito de `whatsAppOutbox`
 * (`channels/whatsapp/whatsapp-channel.adapter.ts`): permitir que testes
 * verifiquem que uma resposta foi "enviada" pelo canal, sem UI real nem
 * API externa envolvida.
 */
export const webChatOutbox: OutboundWebChatMessage[] = [];

export const webChannelAdapter: WebChannelAdapter = {
  channel: 'web',

  toHubMessage: (message) => {
    const hubMessage: HubMessage = {
      id: `web:${message.sessionId}:${message.receivedAt}`,
      channel: 'web',
      userId: message.sessionId,
      type: 'text',
      content: message.text,
      receivedAt: new Date(message.receivedAt),
    };
    return hubMessage;
  },

  sendMessage: async (userId, text) => {
    webChatOutbox.push({ sessionId: userId, text });
  },
};
