import { ConversationService } from '../../ai/conversation';
import type { NovaContext, NovaTurnResult } from '../../nova/interfaces';

/**
 * Arquitetura preparada para o WhatsApp (CONTROL OS — Preparação para
 * OpenAI GPT-5.5) — ainda NÃO conectada a nenhum webhook real. O objetivo
 * desta camada é isolar o "formato de canal" (mensagem inbound/outbound do
 * WhatsApp) da orquestração da Nova, que já é 100% independente de canal
 * (`ConversationService`, mesma entrada única usada pelo `NovaWorkspace` na
 * UI — "toda conversa deve passar pelo MockAIProvider", não importa o
 * canal). Quando a integração real (Twilio, Meta Cloud API etc.) for
 * adicionada em fase futura, só o adapter muda — a Nova em si, não.
 */

const conversationService = new ConversationService();

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

export interface WhatsAppChannelAdapter {
  /** Recebe uma mensagem inbound, roda pela Nova e devolve a resposta pronta para envio. */
  handleInboundMessage: (
    message: InboundWhatsAppMessage,
    ctx: NovaContext
  ) => Promise<OutboundWhatsAppMessage>;
}

/**
 * Implementação stub: já delega para `ConversationService.processTurn`
 * (mesma orquestração usada pelo `NovaWorkspace` na UI), mas nada aqui está
 * ligado a um webhook real do WhatsApp — é só a ponte pronta para quando
 * essa integração acontecer.
 */
export const whatsAppChannelAdapter: WhatsAppChannelAdapter = {
  handleInboundMessage: async (message, ctx) => {
    const result: NovaTurnResult = await conversationService.processTurn(message.text, ctx);
    return { to: message.from, text: result.reply };
  },
};
