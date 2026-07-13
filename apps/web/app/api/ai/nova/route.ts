import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { AIProviderErrorCode } from '@/services/ai/errors';
import { SYSTEM_PROMPT } from '@/services/ai/prompts';
import { INTENT_TOOL_SCHEMAS, type ToolSchema } from '@/services/ai/tools/schemas';
import type { ChatMessage, NovaAIRequestBody, NovaAIRequestMode, NovaAIResponseBody, NovaAIToolCall } from '@/services/ai/types';

/**
 * Route Handler server-only (CONTROL OS — Etapa 4: Preparação profissional
 * para OpenAI GPT-5.5). Único lugar de todo o CONTROL OS que:
 *   1. Lê `OPENAI_API_KEY` (nunca prefixado com `NEXT_PUBLIC_` — nunca
 *      chega ao bundle do navegador);
 *   2. Fala com a API oficial da OpenAI (REST direta, sem SDK — ver nota
 *      abaixo);
 *   3. Monta o System Prompt + contexto + tools antes de qualquer chamada.
 *
 * "Nenhuma tela pode conversar diretamente com a OpenAI" — `OpenAIProvider`
 * (client, `services/ai/providers/OpenAIProvider.ts`) só sabe fazer
 * `fetch('/api/ai/nova')`; é esta rota, rodando no servidor, que de fato
 * chama `api.openai.com`.
 *
 * Nota sobre o SDK: o ambiente de build usado para preparar esta etapa não
 * tem acesso à registry do npm para instalar o pacote oficial `openai`.
 * A REST API do Chat Completions é pública, estável e documentada — chamar
 * `https://api.openai.com/v1/chat/completions` via `fetch` nativo é
 * funcionalmente equivalente ao SDK (mesmo endpoint, mesmo contrato) e não
 * adiciona nenhuma dependência nova. Trocar para o SDK oficial depois,
 * caso prefiram, é uma troca isolada só dentro desta rota — nenhum outro
 * arquivo do sistema precisa saber a diferença.
 */

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Teto de tokens de saída por modo (CONTROL OS — Etapa 4.5: Auditoria de
 * Performance). Antes da auditoria a chamada não enviava `max_tokens`
 * nenhum — uma resposta da OpenAI sem limite explícito custa mais e demora
 * mais do que o necessário. Modos que só classificam/extraem (uma tool call
 * curta ou poucas linhas "chave: valor") precisam de bem menos espaço do
 * que modos que geram texto livre para o usuário ler.
 */
const MAX_TOKENS_BY_MODE: Record<NovaAIRequestMode, number> = {
  classify: 200,
  extract: 200,
  summarize: 300,
  suggest: 300,
  generate: 500,
  chat: 500,
};

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false;
  if (!('role' in value) || !('content' in value)) return false;
  const role = value.role;
  return (role === 'user' || role === 'assistant' || role === 'system') && typeof value.content === 'string';
}

/**
 * Type predicate (não cast) — depois do `typeof value.mode !== 'string'`
 * acima, `value.mode` só é `string` genérica; isto narrowa pra
 * `NovaAIRequestMode` comparando contra cada literal, sem `as NovaAIRequestMode`.
 */
function isNovaAIRequestMode(value: string): value is NovaAIRequestMode {
  return (
    value === 'chat' ||
    value === 'generate' ||
    value === 'classify' ||
    value === 'extract' ||
    value === 'summarize' ||
    value === 'suggest'
  );
}

function isNovaAIRequestBody(value: unknown): value is NovaAIRequestBody {
  if (typeof value !== 'object' || value === null) return false;
  if (!('mode' in value) || typeof value.mode !== 'string') return false;
  if (!isNovaAIRequestMode(value.mode)) return false;

  if ('messages' in value && value.messages !== undefined) {
    if (!Array.isArray(value.messages) || !value.messages.every(isChatMessage)) return false;
  }
  if ('prompt' in value && value.prompt !== undefined && typeof value.prompt !== 'string') return false;
  if ('contextSummary' in value && value.contextSummary !== undefined && typeof value.contextSummary !== 'string') {
    return false;
  }
  return true;
}

interface OpenAIToolCallRaw {
  function: { name: string; arguments: string };
}

interface OpenAIChatCompletionResponse {
  content: string | null;
  toolCall: OpenAIToolCallRaw | undefined;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
}

/** Valida campo a campo a resposta bruta da OpenAI — nunca `any`/cast, sempre checagem explícita. */
function parseOpenAIResponse(value: unknown): OpenAIChatCompletionResponse | null {
  if (typeof value !== 'object' || value === null || !('choices' in value)) return null;
  const choices = value.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const first: unknown = choices[0];
  if (typeof first !== 'object' || first === null || !('message' in first)) return null;
  const message = first.message;
  if (typeof message !== 'object' || message === null) return null;

  const content = 'content' in message && typeof message.content === 'string' ? message.content : null;

  let toolCall: OpenAIToolCallRaw | undefined;
  if ('tool_calls' in message && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    const rawCall: unknown = message.tool_calls[0];
    if (
      typeof rawCall === 'object' &&
      rawCall !== null &&
      'function' in rawCall &&
      typeof rawCall.function === 'object' &&
      rawCall.function !== null &&
      'name' in rawCall.function &&
      typeof rawCall.function.name === 'string' &&
      'arguments' in rawCall.function &&
      typeof rawCall.function.arguments === 'string'
    ) {
      toolCall = { function: { name: rawCall.function.name, arguments: rawCall.function.arguments } };
    }
  }

  let usage: OpenAIChatCompletionResponse['usage'];
  if ('usage' in value && typeof value.usage === 'object' && value.usage !== null) {
    const u = value.usage;
    if (
      'prompt_tokens' in u &&
      typeof u.prompt_tokens === 'number' &&
      'completion_tokens' in u &&
      typeof u.completion_tokens === 'number' &&
      'total_tokens' in u &&
      typeof u.total_tokens === 'number'
    ) {
      usage = { promptTokens: u.prompt_tokens, completionTokens: u.completion_tokens, totalTokens: u.total_tokens };
    }
  }

  return { content, toolCall, usage };
}

/** Argumentos de uma tool call só têm campos string/number nas Tools atuais — validado, nunca `any`. */
function parseToolCallArguments(raw: string): Record<string, string | number> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const result: Record<string, string | number> = {};
  for (const [key, val] of Object.entries(parsed)) {
    if (typeof val !== 'string' && typeof val !== 'number') return null;
    result[key] = val;
  }
  return result;
}

function toOpenAITools(schemas: ToolSchema[]): Array<{ type: 'function'; function: ToolSchema }> {
  return schemas.map((schema) => ({ type: 'function', function: schema }));
}

function buildMessages(body: NovaAIRequestBody): ChatMessage[] {
  const systemParts = [SYSTEM_PROMPT];
  if (body.contextSummary) {
    systemParts.push(`Contexto atual do usuário:\n${body.contextSummary}`);
  }
  const system: ChatMessage = { role: 'system', content: systemParts.join('\n\n') };

  if (body.mode === 'chat' && body.messages) {
    return [system, ...body.messages];
  }
  return [system, { role: 'user', content: body.prompt ?? '' }];
}

function logDebug(label: string, detail: Record<string, string | number>): void {
  if (process.env.AI_DEBUG_LOGS !== '1') return;
  // eslint-disable-next-line no-console -- log de desenvolvimento, desligado em produção por padrão.
  console.log(`[nova-ai] ${label}`, detail);
}

function errorResponse(code: AIProviderErrorCode, message: string, status: number): NextResponse<NovaAIResponseBody> {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(request: NextRequest): Promise<NextResponse<NovaAIResponseBody>> {
  const startedAt = Date.now();

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse('invalid_json', 'Corpo da requisição não é um JSON válido.', 400);
  }

  if (!isNovaAIRequestBody(rawBody)) {
    return errorResponse('invalid_json', 'Corpo da requisição não corresponde ao formato esperado.', 400);
  }
  const body = rawBody;

  const aiProvider = process.env.AI_PROVIDER ?? 'mock';
  const apiKey = process.env.OPENAI_API_KEY;
  if (aiProvider !== 'openai' || !apiKey) {
    // Defesa em profundidade: mesmo que o cliente ache que deveria chamar a
    // OpenAI (NEXT_PUBLIC_AI_PROVIDER=openai), a rota só chama de verdade
    // se o SERVIDOR também estiver configurado — nunca gera custo por
    // engano, e nunca quebra: quem chamou trata isto como "indisponível".
    return errorResponse('unavailable', 'Provedor OpenAI não está configurado neste ambiente.', 503);
  }

  const model = process.env.OPENAI_MODEL ?? 'gpt-5.5';
  const messages = buildMessages(body);
  const tools = body.mode === 'classify' ? toOpenAITools(INTENT_TOOL_SCHEMAS) : undefined;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: MAX_TOKENS_BY_MODE[body.mode],
        ...(tools ? { tools, tool_choice: 'auto' } : {}),
      }),
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      logDebug('auth_error', { status: response.status });
      return errorResponse('unavailable', 'Falha de autenticação com a OpenAI.', 503);
    }
    if (response.status === 429) {
      logDebug('rate_limit', { status: response.status });
      return errorResponse('rate_limit', 'A OpenAI sinalizou limite de requisições excedido.', 429);
    }
    if (!response.ok) {
      logDebug('http_error', { status: response.status });
      return errorResponse('unavailable', 'A OpenAI respondeu com um erro.', 502);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return errorResponse('invalid_json', 'Resposta da OpenAI não é um JSON válido.', 502);
    }

    const parsed = parseOpenAIResponse(json);
    if (!parsed) {
      return errorResponse('invalid_response', 'Resposta da OpenAI em formato inesperado.', 502);
    }

    let toolCall: NovaAIToolCall | undefined;
    if (parsed.toolCall) {
      const args = parseToolCallArguments(parsed.toolCall.function.arguments);
      if (args === null) {
        return errorResponse('invalid_json', 'Argumentos da tool call vieram mal formatados.', 502);
      }
      toolCall = { name: parsed.toolCall.function.name, arguments: args };
    }

    logDebug('success', {
      elapsedMs: Date.now() - startedAt,
      mode: body.mode,
      tool: toolCall?.name ?? 'nenhuma',
      totalTokens: parsed.usage?.totalTokens ?? 0,
    });

    const result: NovaAIResponseBody = { ok: true, content: parsed.content ?? '', toolCall };
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logDebug('timeout', { elapsedMs: Date.now() - startedAt });
      return errorResponse('timeout', 'Tempo limite excedido ao chamar a OpenAI.', 504);
    }
    logDebug('unavailable', { elapsedMs: Date.now() - startedAt });
    return errorResponse('unavailable', 'Não foi possível contatar a OpenAI.', 503);
  } finally {
    clearTimeout(timeoutId);
  }
}
