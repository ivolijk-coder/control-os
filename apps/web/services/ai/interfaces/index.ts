import type { NovaIntent } from '@/services/nova';
import type { AIConversationContext, AIExtractedEntities, ChatMessage } from '../types';

/**
 * Contrato único de provedor de IA (CONTROL OS — Preparação para OpenAI
 * GPT-5.5). Toda a comunicação da NOVA com um "cérebro" — determinístico
 * hoje, um LLM real amanhã — passa por esta interface. Trocar de provedor
 * (`MockAIProvider` → `OpenAIProvider`) é só trocar qual classe
 * `getAIProvider()` (`services/ai/config.ts`) devolve; nenhum outro ponto do
 * sistema conhece a diferença.
 *
 * `NovaIntent` é reaproveitado de `services/nova/interfaces` — é o mesmo
 * conceito de "intenção" que a NOVA já usa; não faz sentido duplicá-lo aqui
 * só porque quem classifica passou a ser um `AIProvider`.
 */
export interface AIProvider {
  /** Conversa completa (histórico + turno atual) → resposta em texto. */
  chat(messages: ChatMessage[], context: AIConversationContext): Promise<string>;

  /** Um prompt único → resposta em texto. Usado quando não há histórico multi-turno relevante. */
  generateResponse(prompt: string, context: AIConversationContext): Promise<string>;

  /** Mensagem do usuário → intenção estruturada. A IA nunca executa a intenção — só identifica. */
  classifyIntent(text: string, context: AIConversationContext): Promise<NovaIntent>;

  /** Mensagem do usuário → entidades extraídas (valor, data, horário, título, categoria). */
  extractEntities(text: string): Promise<AIExtractedEntities>;

  /** Texto longo → resumo curto. Usado futuramente por memória/relatórios. */
  summarize(text: string): Promise<string>;

  /** Contexto do usuário → sugestões de próxima ação (ex.: quick actions contextuais). */
  generateSuggestions(context: AIConversationContext): Promise<string[]>;
}
