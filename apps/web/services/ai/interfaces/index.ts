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

/**
 * Uma tool call que o modelo propôs, já traduzida pra `NovaIntent` — pronta
 * pro `IntentResolver`/`ActionExecutor` de `ConversationService` (CONTROL
 * OS — Etapa 5: OpenAI GPT-5.5 como cérebro da NOVA). O provider nunca
 * executa isto — só decide e devolve; quem executa é sempre a mesma cadeia
 * de sempre.
 */
export interface ProposedToolCall {
  /** Id opaco pra correlacionar com o resultado da execução no round seguinte (Responses API: `call_id`). */
  callId: string;
  intent: NovaIntent;
}

/** Resultado de uma tool call já executada por `ActionExecutor` — formatado em texto pro modelo interpretar (nunca o `NovaActionResult` bruto). */
export interface ToolExecutionOutput {
  callId: string;
  output: string;
}

export interface ReasoningTurn {
  /** Presente quando o modelo já decidiu a resposta final — sem tool calls pendentes. */
  replyText?: string;
  /** Tool calls propostas pelo modelo, ainda não executadas — vazio quando `replyText` está presente. */
  toolCalls: ProposedToolCall[];
  /** Token pra continuar a mesma conversa no round seguinte (Responses API: `response.id`). Ausente quando não há mais nada a continuar. */
  continuationToken?: string;
}

/**
 * Contrato do "raciocínio" da NOVA (CONTROL OS — Etapa 5): "A OpenAI passa
 * a ser o mecanismo de raciocínio da NOVA... decide quais ferramentas
 * utilizar." Só o `OpenAIProvider` implementa de verdade — `MockAIProvider`
 * continua usando só `AIProvider.classifyIntent` (fluxo determinístico já
 * existente, intocado por esta etapa). `ConversationService` decide qual
 * caminho seguir olhando `AI_PROVIDER` (`services/ai/config.ts`), nunca
 * `instanceof` — ver `ConversationService.processTurnWithReasoning`.
 */
export interface ReasoningProvider {
  /** Primeiro round: decide se responde direto (`replyText`) ou propõe tool calls. */
  converse(text: string, context: AIConversationContext): Promise<ReasoningTurn>;
  /** Round seguinte: recebe os resultados já executados por `ActionExecutor` e devolve a resposta final. */
  continueWithToolResults(
    continuationToken: string | undefined,
    outputs: ToolExecutionOutput[],
    context: AIConversationContext
  ): Promise<ReasoningTurn>;
}
