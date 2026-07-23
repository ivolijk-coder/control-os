import type { ChannelAdapter, HubMessage } from '@/services/control-hub';

/**
 * Adapter do canal WhatsApp — CONTROL HUB.
 *
 * Antes desta arquitetura (`services/channels/whatsapp/index.ts`, agora
 * removido), este adapter chamava `ConversationService.processTurn`
 * diretamente — exatamente a violação que o CONTROL HUB existe para
 * eliminar: "O WhatsApp NÃO deve conversar diretamente com a NOVA.
 * Nenhum canal deve conversar diretamente com a IA."
 *
 * CONTROL HUB — Fase 8 (Gateway Omnichannel): este arquivo perdeu o
 * método `handleInboundMessage` que tinha até a Fase 7 — ele chamava
 * `controlHub.receive(...)` diretamente, o que fazia deste adapter, ao
 * mesmo tempo, "conversor de formato" E "orquestrador do pipeline" — duas
 * responsabilidades que a Fase 8 explicitamente separa em duas camadas:
 * o `ChannelGateway` (`services/channel-gateway/channel-gateway.ts`) agora
 * é quem chama `controlHub.receive(...)`, localiza/cria a conversa via
 * `ConversationManager`, e devolve a resposta ao canal via `sendMessage`.
 * Este adapter passou a fazer só duas coisas, nenhuma delas sabendo nada
 * sobre o Hub: converter o formato nativo do WhatsApp para `HubMessage`
 * (`toHubMessage`) e devolver uma resposta nesse mesmo formato nativo
 * (`sendMessage`). Nenhum consumidor real chamava `handleInboundMessage`
 * fora deste próprio arquivo — remoção segura, confirmada por busca no
 * repositório inteiro antes desta mudança.
 *
 * Ainda NÃO conectado a nenhum webhook real (Meta Cloud API, Twilio,
 * Evolution API etc.) — `sendMessage` é um MOCK: registra o envio num
 * outbox em memória (`whatsAppOutbox`, exportado só para inspeção em
 * testes) em vez de chamar uma API externa de verdade. Quando a
 * integração real chegar (fase futura, fora do escopo desta), só o lado
 * de transporte muda — `toHubMessage` e a assinatura de `sendMessage`
 * continuam as mesmas, e nada em `ChannelGateway`/`ControlHub` precisa
 * mudar.
 */

export interface InboundWhatsAppMessage {
  /** Número de telefone do remetente, formato E.164 (ex.: "+5511999999999"). */
  from: string;
  text: string;
  /** Timestamp ISO de recebimento — preenchido pelo webhook real no futuro. */
  receivedAt: string;
  /** ID nativo da mensagem da Meta, para deduplicação futura. */
  messageId?: string;
}

export interface OutboundWhatsAppMessage {
  to: string;
  text: string;
}

export interface WhatsAppChannelAdapter extends ChannelAdapter<InboundWhatsAppMessage> {
  readonly channel: 'whatsapp';
}

/**
 * Outbox em memória do mock — cada `sendMessage` bem-sucedido empurra uma
 * entrada aqui. Único propósito: permitir que testes (ver
 * `services/channel-gateway/__tests__`) verifiquem que uma resposta foi
 * de fato "enviada" pelo canal, sem precisar de uma API externa real.
 * Nunca lido por nenhuma camada de produção — se um webhook real
 * substituir este mock no futuro, este array (e as importações dele)
 * somem junto.
 */
export const whatsAppOutbox: OutboundWhatsAppMessage[] = [];

export const whatsAppChannelAdapter: WhatsAppChannelAdapter = {
  channel: 'whatsapp',

  toHubMessage: (message) => {
    const hubMessage: HubMessage = {
      // Composta (telefone + timestamp) na ausência de um ID nativo do
      // WhatsApp nesta fase (sem webhook real ainda) — suficiente para
      // identificar a mensagem de forma estável dentro do pipeline.
      id: message.messageId ?? `whatsapp:${message.from}:${message.receivedAt}`,
      channel: 'whatsapp',
      userId: message.from,
      type: 'text',
      content: message.text,
      receivedAt: new Date(message.receivedAt),
    };
    return hubMessage;
  },

  sendMessage: async (userId, text) => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (token && phoneNumberId) {
      const response = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: userId.replace(/^\+/, ''), type: 'text', text: { body: text } }),
      });

      if (!response.ok) throw new Error(`WhatsApp Cloud API respondeu HTTP ${response.status}`);
      return;
    }

    whatsAppOutbox.push({ to: userId, text });
  },
};
