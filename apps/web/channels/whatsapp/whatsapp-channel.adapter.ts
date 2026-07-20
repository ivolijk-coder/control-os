import { controlHub } from '@/services/control-hub';
import type { ChannelAdapter, HubMessage } from '@/services/control-hub';

/**
 * Adapter do canal WhatsApp — CONTROL HUB.
 *
 * Antes desta arquitetura (`services/channels/whatsapp/index.ts`, agora
 * removido), este adapter chamava `ConversationService.processTurn`
 * diretamente — exatamente a violação que o CONTROL HUB existe para
 * eliminar: "O WhatsApp NÃO deve conversar diretamente com a NOVA.
 * Nenhum canal deve conversar diretamente com a IA." Agora o único
 * destino de qualquer mensagem inbound é `controlHub.receive(...)`; este
 * arquivo não sabe nada sobre `ConversationService`, `NovaContext` ou
 * qualquer detalhe interno da NOVA — só sabe converter o formato nativo
 * do WhatsApp para `HubMessage` e devolver a resposta pro formato nativo
 * de volta.
 *
 * Ainda NÃO conectado a nenhum webhook real (Meta Cloud API, Twilio
 * etc.) — igual antes, esta camada só isola o "formato de canal" da
 * orquestração. Quando a integração real chegar (fase futura), só o
 * lado de transporte muda (como a mensagem chega/sai) — a chamada pro
 * Hub, não.
 */

export interface InboundWhatsAppMessage {
  /** Número de telefone do remetente, formato E.164 (ex.: "+5511999999999"). */
  from: string;
  text: string;
  /** Timestamp ISO de recebimento — preenchido pelo webhook real no futuro. */
  receivedAt: string;
}

export interface OutboundWhatsAppMessage {
  to: string;
  text: string;
}

export interface WhatsAppChannelAdapter extends ChannelAdapter<InboundWhatsAppMessage> {
  readonly channel: 'whatsapp';
  /** Recebe uma mensagem inbound, roda pelo CONTROL HUB e devolve a resposta pronta para envio. */
  handleInboundMessage: (message: InboundWhatsAppMessage) => Promise<OutboundWhatsAppMessage>;
}

const FALLBACK_REPLY = 'Não consegui processar sua mensagem agora — tente novamente em instantes.';

export const whatsAppChannelAdapter: WhatsAppChannelAdapter = {
  channel: 'whatsapp',

  toHubMessage: (message) => {
    const hubMessage: HubMessage = {
      // Composta (telefone + timestamp) na ausência de um ID nativo do
      // WhatsApp nesta fase (sem webhook real ainda) — suficiente para
      // identificar a mensagem de forma estável dentro do pipeline.
      id: `whatsapp:${message.from}:${message.receivedAt}`,
      channel: 'whatsapp',
      userId: message.from,
      type: 'text',
      content: message.text,
      receivedAt: new Date(message.receivedAt),
    };
    return hubMessage;
  },

  handleInboundMessage: async (message) => {
    const hubMessage = whatsAppChannelAdapter.toHubMessage(message);
    const result = await controlHub.receive(hubMessage);
    return { to: message.from, text: result.reply ?? FALLBACK_REPLY };
  },
};
