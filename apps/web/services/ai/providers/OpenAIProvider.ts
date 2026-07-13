import type { NovaIntent } from '@/services/nova';
import { buildModelContextSummary } from '../context/buildModelContext';
import { AIProviderError } from '../errors';
import type { AIProvider } from '../interfaces';
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
 * profissional para OpenAI GPT-5.5).
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
 * fazer com uma intenção classificada; só a devolve. `ConversationService`
 * é quem resolve (`IntentResolver`) e executa (`ActionExecutor`).
 */
export class OpenAIProvider implements AIProvider {
  async chat(messages: ChatMessage[], context: AIConversationContext): Promise<string> {
    const response = await this.callRoute({
      mode: 'chat',
      messages,
      contextSummary: buildModelContextSummary(context),
    });
    return response.content;
  }

  async generateResponse(prompt: string, context: AIConversationContext): Promise<string> {
    const response = await this.callRoute({
      mode: 'generate',
      prompt,
      contextSummary: buildModelContextSummary(context),
    });
    return response.content;
  }

  async classifyIntent(text: string, context: AIConversationContext): Promise<NovaIntent> {
    const response = await this.callRoute({
      mode: 'classify',
      prompt: text,
      contextSummary: buildModelContextSummary(context),
    });
    if (!response.toolCall) {
      return { kind: 'desconhecido', raw: text };
    }
    return mapToolCallToIntent(response.toolCall, text);
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
      contextSummary: buildModelContextSummary(context),
    });
    return response.content
      .split('\n')
      .map((line) => line.replace(/^[-•\d.)\s]+/, '').trim())
      .filter((line) => line.length > 0)
      .slice(0, MAX_SUGGESTIONS);
  }

  /**
   * Único ponto que fala com `/api/ai/nova`. Nunca deixa um erro de rede
   * "cru" escapar — sempre mapeia pra `AIProviderError`, que
   * `ConversationService` já sabe capturar e transformar numa resposta
   * amigável (ver `ConversationService.processTurn`).
   */
  private async callRoute(body: NovaAIRequestBody): Promise<{ content: string; toolCall?: NovaAIToolCall }> {
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
    return { content: raw.content, toolCall: raw.toolCall };
  }
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
      return { kind: 'criar_lembrete', raw, title };
    }
    case 'criar_agenda': {
      const title = requireString(args, 'title');
      if (title === undefined) break;
      return { kind: 'criar_agenda', raw, title, time: requireString(args, 'time') };
    }
    case 'criar_objetivo': {
      const title = requireString(args, 'title');
      if (title === undefined) break;
      return { kind: 'criar_objetivo', raw, title };
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
