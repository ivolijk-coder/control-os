import {
  buildDailyCheckIn,
  buildDebtsSummary,
  buildReply,
  parseAmount,
  parseIntent,
  parseTime,
} from '@/services/nova';
import type { NovaIntent } from '@/services/nova';
import type { AIProvider } from '../interfaces';
import type { AIConversationContext, AIExtractedEntities, ChatMessage } from '../types';

const NO_MESSAGES_REPLY = 'Ainda não recebi nenhuma mensagem para responder.';
const SUGGESTIONS_WITH_DEBTS = ['Ver minhas dívidas', 'Registrar um gasto', 'Organizar meu dia'];
const SUGGESTIONS_DEFAULT = ['Organizar meu dia', 'Registrar um gasto', 'Criar um lembrete'];

/**
 * Provedor de IA determinístico (CONTROL OS — Preparação para OpenAI
 * GPT-5.5). Não é "IA real" — é o parser de regex já existente
 * (`services/nova/intent/parser.ts`) por trás da interface `AIProvider`,
 * para que o resto do sistema (`ConversationService`, `IntentResolver`,
 * Actions) já converse com o formato final, e a troca futura para um LLM
 * real (`OpenAIProvider`) não exija tocar em mais nada.
 *
 * "Toda conversa deve passar pelo MockAIProvider" — por isso ele é o
 * provedor padrão em `services/ai/config.ts` enquanto `AI_PROVIDER` não for
 * `'openai'`.
 */
export class MockAIProvider implements AIProvider {
  async classifyIntent(text: string): Promise<NovaIntent> {
    return parseIntent(text);
  }

  /**
   * Implementação "melhor esforço": classifica a última mensagem do
   * usuário e devolve o texto que a NOVA daria assumindo sucesso — sem
   * executar nada (a IA nunca modifica dados; quem executa são as
   * Actions). O fluxo principal (`ConversationService`) não usa este
   * método para responder após uma ação — ele conhece o resultado real da
   * execução e chama `buildReply` diretamente com o `ok` verdadeiro. `chat`
   * existe para satisfazer o contrato `AIProvider` (útil, por exemplo, para
   * uma prévia sem efeitos colaterais).
   */
  async chat(messages: ChatMessage[], context: AIConversationContext): Promise<string> {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    if (!lastUserMessage) return NO_MESSAGES_REPLY;
    return this.generateResponse(lastUserMessage.content, context);
  }

  async generateResponse(prompt: string, context: AIConversationContext): Promise<string> {
    const intent = parseIntent(prompt);

    if (intent.kind === 'consultar_dividas') {
      return buildDebtsSummary(context.debts);
    }
    if (intent.kind === 'consultar_dia') {
      return buildDailyCheckIn(context.missions, context.agendaEvents, context.financeEntries, context.habits, context.userName);
    }
    // Sem execução real aqui — assume sucesso (`ok = true`) por ser só uma prévia.
    return buildReply(intent, true);
  }

  async extractEntities(text: string): Promise<AIExtractedEntities> {
    const amount = parseAmount(text) ?? undefined;
    const time = parseTime(text);
    return { amount, time };
  }

  async summarize(text: string): Promise<string> {
    const trimmed = text.trim();
    const firstSentence = trimmed.split(/(?<=[.!?])\s/)[0] ?? trimmed;
    return firstSentence.length > 140 ? `${firstSentence.slice(0, 137)}...` : firstSentence;
  }

  async generateSuggestions(context: AIConversationContext): Promise<string[]> {
    return context.debts.length > 0 ? SUGGESTIONS_WITH_DEBTS : SUGGESTIONS_DEFAULT;
  }
}
