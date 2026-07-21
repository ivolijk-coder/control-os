import type { HubChannel } from '@/services/control-hub';

/**
 * Conversation Manager — CONTROL HUB Fase 8 (Gateway Omnichannel).
 *
 * "Criar um serviço responsável por localizar ou criar conversas. Nada
 * específico para WhatsApp." — única responsabilidade: dado um canal +
 * um `userId` (o endereço que aquele canal usa — telefone no WhatsApp,
 * sessionId no Web Chat, e no futuro o que fizer sentido em cada novo
 * canal), devolver um `conversationId` estável. A primeira chamada para
 * um par (canal, userId) cria a conversa; chamadas seguintes com o mesmo
 * par devolvem sempre o mesmo id — é isso que faz `conversationId` ser
 * útil como "thread" que agrupa turnos sucessivos, em vez de um id
 * aleatório por mensagem (isso já existe: `HubMessage.id`).
 *
 * Implementação em memória nesta fase — mesmo espírito do
 * `BrowserMemoryProvider` (`services/memory`, Fase 3 do CONTROL HUB):
 * infraestrutura real primeiro, persistência de verdade (uma tabela
 * `conversations` no Postgres, quando o histórico precisar sobreviver a
 * um restart do processo) é um passo seguinte, deliberadamente fora do
 * escopo desta fase ("quero apenas a infraestrutura").
 */
export interface ConversationManager {
  findOrCreateConversationId(channel: HubChannel, userId: string): string;
}

class InMemoryConversationManager implements ConversationManager {
  private readonly conversationIdsByKey = new Map<string, string>();

  findOrCreateConversationId(channel: HubChannel, userId: string): string {
    const key = `${channel}:${userId}`;
    const existing = this.conversationIdsByKey.get(key);
    if (existing) {
      return existing;
    }

    const conversationId = `conv_${channel}_${userId}_${this.conversationIdsByKey.size + 1}`;
    this.conversationIdsByKey.set(key, conversationId);
    return conversationId;
  }
}

export const conversationManager: ConversationManager = new InMemoryConversationManager();
