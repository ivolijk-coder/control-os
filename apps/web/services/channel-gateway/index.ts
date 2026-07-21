import { channelRegistry } from './channel-registry';
import { webChannelAdapter } from '@/channels/web';
import { whatsAppChannelAdapter } from '@/channels/whatsapp';

/**
 * Ponto único de importação do Channel Gateway — CONTROL HUB Fase 8. Quem
 * quiser despachar uma mensagem de qualquer canal (route handler de
 * webhook, script de teste, futura integração real) importa só daqui.
 *
 * Composition root: registra os adapters de canal disponíveis HOJE
 * ("Hoje: Web Chat, WhatsApp Mock" — pedido original desta fase). Um
 * canal novo (Telegram, e-mail, voz, API pública) entra com uma linha
 * nova aqui, só quando o adapter correspondente existir de verdade —
 * nenhuma outra parte do Channel Gateway ou do CONTROL HUB muda.
 */
channelRegistry.register(webChannelAdapter);
channelRegistry.register(whatsAppChannelAdapter);

export { channelGateway, ChannelGatewayService } from './channel-gateway';
export type { ChannelGateway } from './channel-gateway';
export { channelRegistry } from './channel-registry';
export type { ChannelRegistry } from './channel-registry';
export { conversationManager } from './conversation-manager';
export type { ConversationManager } from './conversation-manager';
