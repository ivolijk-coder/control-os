import type { NovaIntent, NovaPersona } from '@/services/nova';
import { buildModelContextSummary } from '../context/buildModelContext';
import { AIProviderError } from '../errors';
import type { AIProvider, ProposedToolCall, ReasoningProvider, ReasoningTurn, ToolExecutionOutput } from '../interfaces';
import type {
  AIConversationContext,
  AIExtractedEntities,
  ChatMessage,
  NovaAIRequestBody,
  NovaAIResponseBody,
  NovaAIToolCall,
} from '../types';

const ROUTE_URL = '/api/ai/nova';
const MAX_SUGGESTIONS = 5;

/**
 * Provedor real, falando com GPT-5.5 (CONTROL OS — Etapa 4: Preparação
 * profissional para OpenAI GPT-5.5 / Etapa 5: OpenAI GPT-5.5 como cérebro
 * da NOVA).
 *
 * "Nenhuma tela pode conversar diretamente com a OpenAI" e "toda chamada
 * deve utilizar servidor" — por isso esta classe NUNCA importa um SDK de
 * IA nem lê `OPENAI_API_KEY` (essa variável nem existe no bundle do
 * navegador, por não ter o prefixo `NEXT_PUBLIC_`). Ela só sabe conversar
 * com `POST /api/ai/nova` (`app/api/ai/nova/route.ts`), que roda no
 * servidor e é o único lugar que de fato chama a API da OpenAI.
 *
 * "Nenhuma regra de negócio pode existir dentro do provider. Ele apenas
 * envia contexto, envia mensagens, recebe resposta, recebe tool calls,
 * devolve tudo ao ConversationService." — esta classe não decide o que
 * fazer com uma intenção proposta; só a devolve. `ConversationService` é
 * quem resolve (`IntentResolver`) e executa (`ActionExecutor`).
 *
 * Implementa `ReasoningProvider` (Etapa 5) além de `AIProvider` — é o único
 * provider que faz isso; `MockAIProvider` continua só com `AIProvider`.
 */
export class OpenAIProvider implements AIProvider, ReasoningProvider {
  async chat(messages: ChatMessage[], context: AIConversationContext): Promise<string> {
    const response = await this.callRoute({
      mode: 'chat',
      messages,
      contextSummary: await buildModelContextSummary(context),
    });
    return response.content;
  }

  async generateResponse(prompt: string, context: AIConversationContext): Promise<string> {
    const response = await this.callRoute({
      mode: 'generate',
      prompt,
      contextSummary: await buildModelContextSummary(context),
    });
    return response.content;
  }

  async classifyIntent(text: string, context: AIConversationContext): Promise<NovaIntent> {
    const response = await this.callRoute({
      mode: 'classify',
      prompt: text,
      contextSummary: await buildModelContextSummary(context),
    });
    const [firstCall] = response.toolCalls;
    if (!firstCall) {
      return { kind: 'desconhecido', raw: text };
    }
    return mapToolCallToIntent(firstCall, text);
  }

  async extractEntities(text: string): Promise<AIExtractedEntities> {
    const response = await this.callRoute({ mode: 'extract', prompt: text });
    return parseEntitiesFromLines(response.content);
  }

  async summarize(text: string): Promise<string> {
    const response = await this.callRoute({ mode: 'summarize', prompt: text });
    return response.content;
  }

  async generateSuggestions(context: AIConversationContext): Promise<string[]> {
    const response = await this.callRoute({
      mode: 'suggest',
      contextSummary: await buildModelContextSummary(context),
    });
    return response.content
      .split('\n')
      .map((line) => line.replace(/^[-•\d.)\s]+/, '').trim())
      .filter((line) => line.length > 0)
      .slice(0, MAX_SUGGESTIONS);
  }

  /**
   * Primeiro round do raciocínio (CONTROL OS — Etapa 5): manda a mensagem
   * do usuário + todas as Tools disponíveis pra OpenAI decidir sozinha —
   * responde direto (`replyText`) ou propõe uma ou mais tool calls.
   * `ConversationService` é quem resolve cada uma via `IntentResolver` e
   * decide se executa na hora ou pausa pra confirmação (ações sensíveis).
   */
  async converse(text: string, context: AIConversationContext, persona: NovaPersona): Promise<ReasoningTurn> {
    const response = await this.callRoute({
      mode: 'reason',
      prompt: text,
      contextSummary: await buildModelContextSummary(context),
      persona,
    });
    return toReasoningTurn(response, text);
  }

  /**
   * Segundo round: devolve à OpenAI o resultado real de cada tool call já
   * executada por `ActionExecutor`, e recebe de volta a resposta final em
   * linguagem natural — "OpenAI monta resposta" (diagrama da Etapa 5).
   * `continuationToken` (Responses API: `previous_response_id`) é o que
   * permite não reenviar a conversa inteira a cada round.
   */
  async continueWithToolResults(
    continuationToken: string | undefined,
    outputs: ToolExecutionOutput[],
    context: AIConversationContext,
    persona: NovaPersona
  ): Promise<ReasoningTurn> {
    const response = await this.callRoute({
      mode: 'reason',
      previousResponseId: continuationToken,
      toolOutputs: outputs.map((output) => ({ callId: output.callId, output: output.output })),
      contextSummary: await buildModelContextSummary(context),
      persona,
    });
    // Sem `text` de usuário nesta chamada — só usado se a OpenAI, contra o
    // esperado, propuser MAIS uma tool call neste round (ver
    // `ConversationService.processTurnWithReasoning`, que trata isso como
    // caso defensivo, não como loop normal).
    return toReasoningTurn(response, '(continuação)');
  }

  /**
   * Único ponto que fala com `/api/ai/nova`. Nunca deixa um erro de rede
   * "cru" escapar — sempre mapeia pra `AIProviderError`, que
   * `ConversationService` já sabe capturar e transformar numa resposta
   * amigável (ver `ConversationService.processTurn`).
   */
  private async callRoute(
    body: NovaAIRequestBody
  ): Promise<{ content: string; toolCalls: NovaAIToolCall[]; responseId: string | undefined }> {
    let raw: unknown;
    try {
      const response = await fetch(ROUTE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      raw = await response.json();
    } catch {
      throw new AIProviderError('unavailable');
    }

    if (!isNovaAIResponseBody(raw)) {
      throw new AIProviderError('invalid_response');
    }
    if (!raw.ok) {
      throw new AIProviderError(raw.code, raw.message);
    }
    return { content: raw.content, toolCalls: raw.toolCalls, responseId: raw.responseId };
  }
}

/** Converte a resposta crua da rota num `ReasoningTurn` — usado por `converse` e `continueWithToolResults`. */
function toReasoningTurn(
  response: { content: string; toolCalls: NovaAIToolCall[]; responseId: string | undefined },
  raw: string
): ReasoningTurn {
  if (response.toolCalls.length === 0) {
    return { replyText: response.content, toolCalls: [], continuationToken: response.responseId };
  }
  const toolCalls: ProposedToolCall[] = response.toolCalls.map((call) => ({
    callId: call.callId,
    intent: mapToolCallToIntent(call, raw),
  }));
  return { toolCalls, continuationToken: response.responseId };
}

function isNovaAIResponseBody(value: unknown): value is NovaAIResponseBody {
  if (typeof value !== 'object' || value === null || !('ok' in value)) return false;
  if (value.ok === true) return 'content' in value && typeof value.content === 'string';
  if (value.ok === false) return 'code' in value && 'message' in value && typeof value.message === 'string';
  return false;
}

/** Extrai um número de um argumento de tool call que deveria ser number. */
function requireNumber(args: Record<string, string | number>, key: string): number | undefined {
  const value = args[key];
  return typeof value === 'number' ? value : undefined;
}

/** Extrai uma string de um argumento de tool call que deveria ser string. */
function requireString(args: Record<string, string | number>, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Mapeia uma tool call (nome + argumentos já validados como string/number
 * pela Route Handler) de volta para o `NovaIntent` discriminado
 * correspondente — campo a campo, sem `any`/cast. Nomes de tool batem 1:1
 * com `NovaIntentKind` (ver `services/ai/tools/schemas.ts`).
 */
function mapToolCallToIntent(toolCall: NovaAIToolCall, raw: string): NovaIntent {
  const { name, arguments: args } = toolCall;

  switch (name) {
    case 'registrar_despesa': {
      const amount = requireNumber(args, 'amount');
      const description = requireString(args, 'description');
      if (amount === undefined || description === undefined) break;
      return { kind: 'registrar_despesa', raw, amount, description };
    }
    case 'registrar_receita': {
      const amount = requireNumber(args, 'amount');
      const description = requireString(args, 'description');
      if (amount === undefined || description === undefined) break;
      return { kind: 'registrar_receita', raw, amount, description };
    }
    case 'criar_lembrete': {
      const title = requireString(args, 'title');
      if (title === undefined) break;
      return { kind: 'criar_lembrete', raw, title, dueDate: requireString(args, 'dueDate'), time: requireString(args, 'time') };
    }
    case 'criar_agenda': {
      const title = requireString(args, 'title');
      if (title === undefined) break;
      return { kind: 'criar_agenda', raw, title, time: requireString(args, 'time'), date: requireString(args, 'date') };
    }
    case 'excluir_agenda': {
      const eventId = requireString(args, 'eventId');
      const title = requireString(args, 'title');
      if (eventId === undefined || title === undefined) break;
      return { kind: 'excluir_agenda', raw, eventId, title };
    }
    case 'criar_objetivo': {
      const title = requireString(args, 'title');
      if (title === undefined) break;
      return { kind: 'criar_objetivo', raw, title, dueDate: requireString(args, 'dueDate') };
    }
    case 'criar_projeto': {
      const title = requireString(args, 'title');
      if (title === undefined) break;
      return { kind: 'criar_projeto', raw, title };
    }
    case 'registrar_divida': {
      const totalAmount = requireNumber(args, 'totalAmount');
      const description = requireString(args, 'description');
      if (totalAmount === undefined || description === undefined) break;
      const installments = requireNumber(args, 'installments') ?? 1;
      return { kind: 'registrar_divida', raw, totalAmount, installments, description };
    }
    case 'criar_habito': {
      const title = requireString(args, 'title');
      if (title === undefined) break;
      return { kind: 'criar_habito', raw, title, category: requireString(args, 'category') };
    }
    case 'criar_viagem': {
      const destination = requireString(args, 'destination');
      const startDate = requireString(args, 'startDate');
      const endDate = requireString(args, 'endDate');
      if (destination === undefined || startDate === undefined || endDate === undefined) break;
      return { kind: 'criar_viagem', raw, destination, startDate, endDate, budget: requireNumber(args, 'budget') };
    }
    case 'criar_documento': {
      const title = requireString(args, 'title');
      if (title === undefined) break;
      return {
        kind: 'criar_documento',
        raw,
        title,
        category: requireString(args, 'category'),
        expiresAt: requireString(args, 'expiresAt'),
      };
    }
    case 'criar_bem': {
      const name = requireString(args, 'name');
      const estimatedValue = requireNumber(args, 'estimatedValue');
      if (name === undefined || estimatedValue === undefined) break;
      return { kind: 'criar_bem', raw, name, estimatedValue, category: requireString(args, 'category') };
    }
    case 'criar_nota': {
      const title = requireString(args, 'title');
      const content = requireString(args, 'content');
      if (title === undefined || content === undefined) break;
      return { kind: 'criar_nota', raw, title, content, category: requireString(args, 'category') };
    }
    case 'pagar_conta_fixa': {
      const name = requireString(args, 'name');
      if (name === undefined) break;
      return { kind: 'pagar_conta_fixa', raw, name };
    }
    case 'consultar_contas_vencendo': {
      const period = requireString(args, 'period');
      if (period !== 'amanha' && period !== 'semana') break;
      return { kind: 'consultar_contas_vencendo', raw, period };
    }
  }

  // Tool desconhecida ou argumentos incompletos — não inventa dado faltando.
  return { kind: 'desconhecido', raw };
}

/** Parseia linhas "chave: valor" numa `AIExtractedEntities` — formato pedido ao modelo no modo `'extract'`. */
function parseEntitiesFromLines(content: string): AIExtractedEntities {
  const entities: AIExtractedEntities = {};
  for (const line of content.split('\n')) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (!value) continue;

    if (key === 'amount') {
      const parsed = Number(value.replace(',', '.'));
      if (Number.isFinite(parsed)) entities.amount = parsed;
    } else if (key === 'date') {
      entities.date = value;
    } else if (key === 'time') {
      entities.time = value;
    } else if (key === 'title') {
      entities.title = value;
    } else if (key === 'category') {
      entities.category = value;
    }
  }
  return entities;
}
