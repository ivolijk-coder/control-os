/**
 * Resumo automático de conversa (CONTROL OS — Etapa 4: Preparação
 * profissional para OpenAI GPT-5.5). "A arquitetura deve suportar milhares
 * de mensagens sem crescer indefinidamente." `useAppStore.novaMessages` já
 * tinha um teto simples (últimas 100, corta o resto — ver `lib/store.ts`);
 * isto vai além: quando a conversa passa de `CONDENSE_THRESHOLD`
 * mensagens, as mais antigas (tudo exceto as últimas `KEEP_RECENT_TURNS`)
 * são condensadas num único resumo em texto — perde detalhe, mas preserva
 * o essencial, e o histórico para de crescer.
 *
 * Deliberadamente sem dependência de `components/nova/nova-message-bubble`
 * (tipo de UI) — `ConversationTurnLike` é só o mínimo que faz sentido pra
 * um resumo (quem falou, o que falou). Quem decide como reconstruir a
 * lista de mensagens exibidas é a UI (`NovaWorkspace`), não esta camada.
 */
export interface ConversationTurnLike {
  role: 'user' | 'nova';
  content: string;
}

export const CONDENSE_THRESHOLD = 40;
export const KEEP_RECENT_TURNS = 20;

export function shouldCondense(turnCount: number): boolean {
  return turnCount > CONDENSE_THRESHOLD;
}

export function buildOlderTurnsText(turns: ConversationTurnLike[]): string {
  return turns.map((turn) => `${turn.role === 'user' ? 'Usuário' : 'NOVA'}: ${turn.content}`).join('\n');
}
