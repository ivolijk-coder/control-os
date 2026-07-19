import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { AIProviderErrorCode } from '@/services/ai/errors';
import { buildSystemPrompt } from '@/services/ai/prompts';
import { INTENT_TOOL_SCHEMAS, type ToolSchema } from '@/services/ai/tools/schemas';
import type {
  ChatMessage,
  NovaAIRequestBody,
  NovaAIRequestMode,
  NovaAIResponseBody,
  NovaAIToolCall,
  NovaAIToolOutput,
} from '@/services/ai/types';
import type { NovaPersona } from '@/services/nova';

/**
 * Route Handler server-only (CONTROL OS — Etapa 4: Preparação profissional
 * para OpenAI GPT-5.5 / Etapa 5: OpenAI GPT-5.5 como cérebro da NOVA).
 * Único lugar de todo o CONTROL OS que:
 *   1. Lê `OPENAI_API_KEY` (nunca prefixado com `NEXT_PUBLIC_` — nunca
 *      chega ao bundle do navegador);
 *   2. Fala com a API oficial da OpenAI (REST direta, sem SDK — ver nota
 *      abaixo);
 *   3. Monta as instruções (System Prompt + contexto) + Tools antes de
 *      qualquer chamada.
 *
 * "Nenhuma tela pode conversar diretamente com a OpenAI" — `OpenAIProvider`
 * (client, `services/ai/providers/OpenAIProvider.ts`) só sabe fazer
 * `fetch('/api/ai/nova')`; é esta rota, rodando no servidor, que de fato
 * chama `api.openai.com`.
 *
 * Etapa 5 — Responses API: "Utilizar a Responses API da OpenAI. Não
 * utilizar implementações antigas se não forem necessárias." Esta rota
 * chama `POST /v1/responses` (não mais `/v1/chat/completions`) para TODOS
 * os modos — `instructions` substitui a mensagem `system`, `input`
 * substitui `messages`, `max_output_tokens` substitui `max_tokens`. O modo
 * `'reason'` é o único que usa Tools e suporta continuação via
 * `previous_response_id` — é ele que faz o loop "OpenAI decide → Tool →
 * ActionExecutor → resultado → OpenAI narra" (ver `ConversationService`).
 *
 * Etapa 6 — IA-Native: esta rota não ganhou nenhum modo novo nem endpoint
 * novo. A NOVA CORE virar "o centro do sistema" é uma mudança de
 * `SystemPrompt` (o que a NOVA entende que pode fazer) e de contexto (o
 * que ela sabe sobre o usuário), não de infraestrutura — por isso o único
 * ajuste aqui foi o teto de tokens do modo `'reason'` (ver
 * `MAX_OUTPUT_TOKENS_BY_MODE` abaixo), pra caber turnos que compõem várias
 * Tools reais de uma vez (ex.: viagem = criar_viagem + criar_objetivo +
 * lembretes).
 *
 * Nota sobre o SDK: o ambiente de build usado para preparar esta etapa não
 * tem acesso à registry do npm para instalar o pacote oficial `openai`.
 * A Responses API é pública, estável e documentada — chamar
 * `https://api.openai.com/v1/responses` via `fetch` nativo é funcionalmente
 * equivalente ao SDK (mesmo endpoint, mesmo contrato) e não adiciona
 * nenhuma dependência nova. Trocar para o SDK oficial depois, caso
 * prefiram, é uma troca isolada só dentro desta rota — nenhum outro arquivo
 * do sistema precisa saber a diferença.
 */

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Teto de tokens de saída por modo (CONTROL OS — Etapa 4.5: Auditoria de
 * Performance, valores revistos na Etapa 5, `'reason'` revisto de novo na
 * Etapa 6: IA-Native). Modelos de raciocínio como o GPT-5.5 gastam parte
 * de `max_output_tokens` em tokens de raciocínio internos (não visíveis)
 * antes do texto/tool call final — por isso os limites aqui são mais
 * generosos que um teto "só de texto visível" seria; um valor baixo demais
 * pode truncar a resposta antes do texto aparecer.
 * `'reason'` é o maior porque pode precisar decidir várias tool calls no
 * mesmo turno — a Etapa 6 pede explicitamente que pedidos de vida maiores
 * ("quero viajar", "quero comprar uma casa") virem várias Tools reais
 * compostas num único turno (ex.: viagem + meta financeira + 2-3
 * lembretes), então o teto subiu de 900 pra 1400 pra não truncar esse tipo
 * de resposta antes de todas as tool calls saírem.
 */
const MAX_OUTPUT_TOKENS_BY_MODE: Record<NovaAIRequestMode, number> = {
  classify: 400,
  extract: 400,
  summarize: 500,
  suggest: 500,
  generate: 700,
  chat: 700,
  reason: 1400,
};

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false;
  if (!('role' in value) || !('content' in value)) return false;
  const role = value.role;
  return (role === 'user' || role === 'assistant' || role === 'system') && typeof value.content === 'string';
}

function isNovaAIToolOutput(value: unknown): value is NovaAIToolOutput {
  if (typeof value !== 'object' || value === null) return false;
  if (!('callId' in value) || !('output' in value)) return false;
  return typeof value.callId === 'string' && typeof value.output === 'string';
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
    value === 'suggest' ||
    value === 'reason'
  );
}

/** CONTROL OS — Etapa 15 (LEGENDARY): type predicate, mesmo padrão de `isNovaAIRequestMode`. */
function isNovaPersona(value: string): value is NovaPersona {
  return value === 'nova' || value === 'legendary';
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
  if ('previousResponseId' in value && value.previousResponseId !== undefined && typeof value.previousResponseId !== 'string') {
    return false;
  }
  if ('toolOutputs' in value && value.toolOutputs !== undefined) {
    if (!Array.isArray(value.toolOutputs) || !value.toolOutputs.every(isNovaAIToolOutput)) return false;
  }
  if ('persona' in value && value.persona !== undefined) {
    if (typeof value.persona !== 'string' || !isNovaPersona(value.persona)) return false;
  }
  return true;
}

interface OpenAIResponseFunctionCall {
  callId: string;
  name: string;
  arguments: string;
}

interface OpenAIResponsesResult {
  responseId: string;
  outputText: string;
  functionCalls: OpenAIResponseFunctionCall[];
  usage: { inputTokens: number; outputTokens: number; totalTokens: number; reasoningTokens: number } | undefined;
}

/**
 * Valida campo a campo a resposta bruta da Responses API — nunca
 * `any`/cast, sempre checagem explícita. Formato: `{id, output: [...],
 * usage}`, onde `output` mistura itens `type: 'message'` (com
 * `content: [{type:'output_text', text}]`) e `type: 'function_call'` (com
 * `call_id`, `name`, `arguments` já serializado em JSON).
 */
function parseResponsesApiResult(value: unknown): OpenAIResponsesResult | null {
  if (typeof value !== 'object' || value === null) return null;
  if (!('id' in value) || typeof value.id !== 'string') return null;
  if (!('output' in value) || !Array.isArray(value.output)) return null;

  let outputText = '';
  const functionCalls: OpenAIResponseFunctionCall[] = [];

  for (const item of value.output) {
    if (typeof item !== 'object' || item === null || !('type' in item)) continue;

    if (item.type === 'message' && 'content' in item && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (
          typeof part === 'object' &&
          part !== null &&
          'type' in part &&
          part.type === 'output_text' &&
          'text' in part &&
          typeof part.text === 'string'
        ) {
          outputText += part.text;
        }
      }
      continue;
    }

    if (
      item.type === 'function_call' &&
      'call_id' in item &&
      typeof item.call_id === 'string' &&
      'name' in item &&
      typeof item.name === 'string' &&
      'arguments' in item &&
      typeof item.arguments === 'string'
    ) {
      functionCalls.push({ callId: item.call_id, name: item.name, arguments: item.arguments });
    }
  }

  let usage: OpenAIResponsesResult['usage'];
  if ('usage' in value && typeof value.usage === 'object' && value.usage !== null) {
    const u = value.usage;
    if ('input_tokens' in u && typeof u.input_tokens === 'number' && 'output_tokens' in u && typeof u.output_tokens === 'number') {
      const totalTokens =
        'total_tokens' in u && typeof u.total_tokens === 'number' ? u.total_tokens : u.input_tokens + u.output_tokens;
      let reasoningTokens = 0;
      if (
        'output_tokens_details' in u &&
        typeof u.output_tokens_details === 'object' &&
        u.output_tokens_details !== null &&
        'reasoning_tokens' in u.output_tokens_details &&
        typeof u.output_tokens_details.reasoning_tokens === 'number'
      ) {
        reasoningTokens = u.output_tokens_details.reasoning_tokens;
      }
      usage = { inputTokens: u.input_tokens, outputTokens: u.output_tokens, totalTokens, reasoningTokens };
    }
  }

  return { responseId: value.id, outputText, functionCalls, usage };
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

/** Formato "function tool" da Responses API — campos soltos (`name`, `parameters`), diferente do aninhado `function: {...}` da Chat Completions. */
function toOpenAITools(schemas: ToolSchema[]): Array<{ type: 'function'; name: string; description: string; parameters: ToolSchema['parameters']; strict: boolean }> {
  return schemas.map((schema) => ({
    type: 'function',
    name: schema.name,
    description: schema.description,
    parameters: schema.parameters,
    // `strict: false` — nossos schemas têm propriedades opcionais (ex.: `category?`), e o modo strict da
    // Responses API exige que todo campo de `properties` esteja em `required` (usando `null` pra opcionais).
    // Mudar esse formato só pra ganhar `strict: true` não vale a complexidade nesta fase.
    strict: false,
  }));
}

function buildInstructions(contextSummary: string | undefined, persona: NovaPersona | undefined): string {
  const parts = [buildSystemPrompt(persona)];
  if (contextSummary) {
    parts.push(`Contexto atual do usuário:\n${contextSummary}`);
  }
  return parts.join('\n\n');
}

type ResponsesInputItem = { role: 'user' | 'assistant' | 'system'; content: string } | { type: 'function_call_output'; call_id: string; output: string };

/**
 * Monta o `input` da Responses API. Três formatos possíveis:
 *   1. Continuação do modo `'reason'` (`toolOutputs` presente): só os
 *      resultados das tool calls — o resto da conversa já está no lado da
 *      OpenAI via `previous_response_id`.
 *   2. Modo `'chat'`: histórico completo.
 *   3. Qualquer outro modo: uma única mensagem de usuário.
 */
function buildResponsesInput(body: NovaAIRequestBody): ResponsesInputItem[] {
  if (body.toolOutputs && body.toolOutputs.length > 0) {
    return body.toolOutputs.map((output) => ({ type: 'function_call_output', call_id: output.callId, output: output.output }));
  }
  if (body.mode === 'chat' && body.messages) {
    return body.messages.map((message) => ({ role: message.role, content: message.content }));
  }
  return [{ role: 'user', content: body.prompt ?? '' }];
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
  const instructions = buildInstructions(body.contextSummary, body.persona);
  const input = buildResponsesInput(body);
  // CONTROL OS — papéis definitivos das duas inteligências: a NOVA executa,
  // a LEGENDARY desenvolve — ela NUNCA executa ações operacionais (ver
  // `SystemPrompt.ts`, "Tools por especialidade"). Isso não pode depender só
  // do texto do prompt pedindo pra ela não usar Tools — o modelo literalmente
  // não pode receber a lista de Tools de execução quando a persona é
  // `legendary`, mesma defesa em profundidade já aplicada acima pro provedor.
  const canUseTools = (body.mode === 'reason' || body.mode === 'classify') && body.persona !== 'legendary';
  const tools = canUseTools ? toOpenAITools(INTENT_TOOL_SCHEMAS) : undefined;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions,
        input,
        max_output_tokens: MAX_OUTPUT_TOKENS_BY_MODE[body.mode],
        ...(tools ? { tools, tool_choice: 'auto' } : {}),
        ...(body.previousResponseId ? { previous_response_id: body.previousResponseId } : {}),
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

    const parsed = parseResponsesApiResult(json);
    if (!parsed) {
      return errorResponse('invalid_response', 'Resposta da OpenAI em formato inesperado.', 502);
    }

    const toolCalls: NovaAIToolCall[] = [];
    for (const call of parsed.functionCalls) {
      const args = parseToolCallArguments(call.arguments);
      if (args === null) {
        return errorResponse('invalid_json', 'Argumentos de uma tool call vieram mal formatados.', 502);
      }
      toolCalls.push({ callId: call.callId, name: call.name, arguments: args });
    }

    logDebug('success', {
      elapsedMs: Date.now() - startedAt,
      mode: body.mode,
      tools: toolCalls.length > 0 ? toolCalls.map((call) => call.name).join(',') : 'nenhuma',
      totalTokens: parsed.usage?.totalTokens ?? 0,
      reasoningTokens: parsed.usage?.reasoningTokens ?? 0,
    });

    const result: NovaAIResponseBody = { ok: true, content: parsed.outputText, toolCalls, responseId: parsed.responseId };
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
