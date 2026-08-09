import { LLMProviderError } from '../errors';
import type { LLMProvider } from '../llm.interfaces';
import type { LLMRequest, LLMResponse } from '../llm.types';

/**
 * `OpenAILLMProvider` — a implementação inicial da abstração `LLMProvider`
 * (CONTROL HUB — Fase 5). "Ela será a única responsável por conhecer a API
 * da OpenAI" dentro desta nova camada de inteligência do Decision Engine.
 *
 * Nome deliberadamente diferente do pedido literal ("OpenAIProvider"):
 * `services/ai/providers/OpenAIProvider.ts` já existe (Etapa 4/5, pipeline
 * de conversa antigo) — reaproveitar o mesmo nome de classe em módulos
 * diferentes seria confuso em qualquer stack trace/import ambíguo. Mesmo
 * conceito ("fala com a OpenAI"), namespace diferente (`services/llm/`, não
 * `services/ai/`) — sem colisão de import (caminhos diferentes), mas o
 * NOME também diferente evita ambiguidade humana.
 *
 * Desvio deliberado do padrão existente em `app/api/ai/nova/route.ts`
 * (que faz `OPENAI_API_KEY` só ser lido dentro de uma Route Handler, porque
 * o `OpenAIProvider` antigo roda no NAVEGADOR e só sabe fazer
 * `fetch('/api/ai/nova')`): esta classe roda dentro do Decision Engine
 * (`services/decision-engine`), que por sua vez só é chamado por
 * `ControlHubService` — uma cadeia 100% server-side (nenhum componente
 * `'use client'` importa `services/control-hub`, confirmado por auditoria
 * desta fase). "Nenhuma tela pode conversar diretamente com a OpenAI"
 * continua verdade aqui: não existe TELA nenhuma nesta cadeia, só serviços
 * de servidor — chamar `api.openai.com` diretamente desta classe preserva a
 * mesma garantia de segurança (a chave nunca chega ao bundle do navegador,
 * porque `OPENAI_API_KEY` nunca tem o prefixo `NEXT_PUBLIC_`) sem depender
 * de uma Route Handler intermediária, que só faria sentido para um
 * consumidor rodando no navegador — o que o Decision Engine nunca é.
 *
 * Reaproveita as MESMAS convenções já estabelecidas em
 * `app/api/ai/nova/route.ts` — endpoint (`/v1/responses`), nomes de env var
 * (`OPENAI_API_KEY`, `OPENAI_MODEL`), timeout (20s via `AbortController`),
 * `fetch` nativo sem SDK (mesmo motivo: sandbox sem acesso à registry do
 * npm) — só a superfície de parsing é deliberadamente menor: "não
 * implementar Function Calling nesta etapa" significa que este provider
 * nunca envia `tools` nem precisa entender itens `type: 'function_call'` na
 * resposta — só texto (`output_text`). Reescrever aqui o parser completo de
 * `route.ts` (que também entende tool calls) seria duplicar uma
 * preocupação mais ampla que esta classe nunca tem; o parser abaixo cobre
 * só o subconjunto que de fato importa pra este caso de uso.
 *
 * `text: { format: { type: 'json_object' } }` — pede à Responses API pra
 * garantir que a saída seja um JSON válido (sem garantir o SCHEMA — quem
 * valida o formato exato esperado, `{ actions: [...] }`, é
 * `parseLLMDecisionResponse`, em `services/decision-engine`). Não usamos
 * `json_schema` (que enforçaria o formato inteiro do lado da OpenAI) de
 * propósito: manter a validação do lado do Decision Engine é o que permite
 * trocar de provedor (Anthropic, Gemini...) sem depender de um recurso
 * específico da API da OpenAI.
 */
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_OUTPUT_TOKENS = 700;

interface OpenAIResponsesTextResult {
  outputText: string;
}

/**
 * Parser deliberadamente mais estreito que `parseResponsesApiResult`
 * (`app/api/ai/nova/route.ts`) — só extrai texto (`type: 'message'` →
 * `output_text`), nunca `function_call` (este provider nunca envia `tools`,
 * então a API nunca devolveria isso aqui). Ver doc da classe acima.
 */
function parseResponsesApiTextOutput(value: unknown): OpenAIResponsesTextResult | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  if (!('output' in value) || !Array.isArray(value.output)) return undefined;

  let outputText = '';
  for (const item of value.output) {
    if (typeof item !== 'object' || item === null || !('type' in item) || item.type !== 'message') continue;
    if (!('content' in item) || !Array.isArray(item.content)) continue;
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
  }
  return { outputText };
}

export class OpenAILLMProvider implements LLMProvider {
  async complete(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new LLMProviderError('unavailable', 'OPENAI_API_KEY não configurada neste ambiente.');
    }

    const model = process.env.OPENAI_MODEL ?? 'gpt-5.5';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          input: [{ role: 'user', content: request.prompt }],
          // `format` ausente = `'json'`: preserva byte a byte o corpo enviado
          // antes da PR10.4, para que o Decision Engine não regrida. Nenhum
          // caminho aqui envia `tools` — em nenhum dos dois formatos.
          text: { format: { type: request.format === 'text' ? 'text' : 'json_object' } },
          max_output_tokens: MAX_OUTPUT_TOKENS,
        }),
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        throw new LLMProviderError('unavailable', 'Falha de autenticação com a OpenAI.');
      }
      if (response.status === 429) {
        throw new LLMProviderError('rate_limit', 'A OpenAI sinalizou limite de requisições excedido.');
      }
      if (!response.ok) {
        throw new LLMProviderError('unavailable', `A OpenAI respondeu com status ${response.status}.`);
      }

      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new LLMProviderError('invalid_response', 'Resposta da OpenAI não é um JSON válido.');
      }

      const parsed = parseResponsesApiTextOutput(json);
      if (!parsed) {
        throw new LLMProviderError('invalid_response', 'Resposta da OpenAI em formato inesperado.');
      }
      return { content: parsed.outputText };
    } catch (error) {
      if (error instanceof LLMProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new LLMProviderError('timeout', 'Tempo limite excedido ao chamar a OpenAI.');
      }
      throw new LLMProviderError('unavailable', 'Não foi possível contatar a OpenAI.');
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
