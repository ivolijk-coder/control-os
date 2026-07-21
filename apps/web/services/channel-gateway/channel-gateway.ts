import { controlHub as defaultControlHub } from '@/services/control-hub';
import type { ControlHub, HubChannel, HubMessage, HubPipelineResult } from '@/services/control-hub';
import { channelRegistry as defaultChannelRegistry } from './channel-registry';
import type { ChannelRegistry } from './channel-registry';
import { conversationManager as defaultConversationManager } from './conversation-manager';
import type { ConversationManager } from './conversation-manager';

/**
 * Channel Gateway — CONTROL HUB Fase 8 (Gateway Omnichannel).
 *
 * Camada explícita que faltava entre "canais" e "CONTROL HUB":
 *
 *   WhatsApp / Web Chat / (futuro: Telegram, e-mail, voz, API)
 *         ↓
 *   Channel Gateway   ← este arquivo
 *         ↓
 *   CONTROL HUB → Context Provider → Memory Layer → Decision Engine →
 *   Action Engine → Modules → Repositories → PostgreSQL
 *
 * Até a Fase 7, cada adapter de canal (ex.: `whatsAppChannelAdapter`)
 * chamava `controlHub.receive(...)` diretamente — funcionava, mas
 * misturava duas responsabilidades no mesmo lugar: "converter formato
 * nativo" e "orquestrar o pipeline". A Fase 8 separa isso: o adapter só
 * sabe converter (`toHubMessage`) e entregar (`sendMessage`); é o
 * `ChannelGateway` quem sabe:
 *
 *   1. Qual adapter cuida de qual canal (via `ChannelRegistry` —
 *      "Registrar canais dinamicamente", nenhum `if/switch` por canal
 *      aqui dentro);
 *   2. Qual conversa esta mensagem pertence (via `ConversationManager` —
 *      "localizar ou criar conversas", preenchendo `conversationId` no
 *      envelope antes de seguir);
 *   3. Que o único destino de qualquer `HubMessage` pronto é
 *      `controlHub.receive(...)` — o mesmo `ControlHub` que já processa
 *      hoje qualquer canal, sem nenhum caminho paralelo — literalmente
 *      "não quero criar uma IA paralela";
 *   4. Que a resposta (`result.reply`, ou um fallback genérico quando o
 *      Hub não decidiu nenhum texto) volta ao usuário através do
 *      `sendMessage` do MESMO adapter que recebeu a mensagem — o Gateway
 *      nunca precisa saber COMO cada canal entrega texto de volta.
 *
 * `receiveMessage` é o nome pedido para o método de entrada do
 * `ChannelAdapter` no pedido original desta fase — aqui vive no Gateway
 * (não no adapter) porque É o verbo de ORQUESTRAÇÃO (converter + rotear
 * + responder), não de conversão pura (ver doc de `ChannelAdapter` em
 * `services/control-hub/control-hub.interfaces.ts` para a justificativa
 * completa dessa divisão).
 */
export interface ChannelGateway {
  receiveMessage<TInbound>(channel: HubChannel, raw: TInbound): Promise<HubPipelineResult>;
}

/**
 * Resposta padrão quando o CONTROL HUB não produziu nenhum texto (ex.:
 * `status === 'rejected'` por falha de validação) — igual ao fallback que
 * o adapter do WhatsApp já usava antes da Fase 8, agora centralizado
 * aqui: todo canal se beneficia do mesmo comportamento, sem duplicar a
 * constante em cada adapter.
 */
const FALLBACK_REPLY = 'Não consegui processar sua mensagem agora — tente novamente em instantes.';

export class ChannelGatewayService implements ChannelGateway {
  constructor(
    private readonly registry: ChannelRegistry = defaultChannelRegistry,
    private readonly conversations: ConversationManager = defaultConversationManager,
    private readonly hub: ControlHub = defaultControlHub
  ) {}

  async receiveMessage<TInbound>(channel: HubChannel, raw: TInbound): Promise<HubPipelineResult> {
    const adapter = this.registry.get(channel);
    if (!adapter) {
      throw new Error(
        `Channel Gateway: nenhum adapter registrado para o canal "${channel}" — ver services/channel-gateway/index.ts.`
      );
    }

    const converted = adapter.toHubMessage(raw);
    const conversationId = this.conversations.findOrCreateConversationId(converted.channel, converted.userId);
    const envelope: HubMessage = { ...converted, conversationId };

    const result = await this.hub.receive(envelope);

    await adapter.sendMessage(envelope.userId, result.reply ?? FALLBACK_REPLY);

    return result;
  }
}

export const channelGateway: ChannelGateway = new ChannelGatewayService();
