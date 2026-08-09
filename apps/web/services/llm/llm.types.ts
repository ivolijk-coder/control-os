/**
 * CONTROL HUB — Fase 5: Decision Engine com IA. "Criar uma abstração:
 * `interface LLMProvider { complete(request: LLMRequest): Promise<LLMResponse>; }`."
 *
 * Módulo novo, irmão de `services/memory`, `services/context-provider`,
 * `services/action-engine` — não vive dentro de `services/decision-engine`
 * nem de `services/ai` de propósito: `LLMProvider` é uma abstração de MAIS
 * BAIXO nível ("conversar com QUALQUER modelo de linguagem, texto entra,
 * texto sai") do que o Decision Engine ("decidir quais Actions rodar a
 * partir de uma mensagem") — o pedido original já antecipa múltiplos
 * consumidores futuros além do Decision Engine ("preparado para... evolução
 * contínua da NOVA e da LEGENDARY, e operação em múltiplos canais"), então
 * merece um módulo próprio, testável e reutilizável isoladamente.
 *
 * Deliberadamente NÃO reaproveita `services/ai/types.ts`
 * (`NovaAIRequestBody`/`NovaAIResponseBody`): aqueles tipos são o contrato
 * HTTP de `POST /api/ai/nova` — carregam `mode`/`toolCalls`/`persona`/
 * `previousResponseId`, todo o vocabulário de Tool Calling e do pipeline de
 * conversa antigo (`ConversationService`). "Não implementar Function
 * Calling nesta etapa" — um `LLMProvider` para o Decision Engine não precisa
 * (e não deve) carregar nenhum desse vocabulário; um contrato "prompt entra,
 * texto sai" é estritamente mais simples e não é o mesmo conceito, então não
 * é duplicação reaproveitável — é um caso de uso genuinamente mais estreito.
 */

/**
 * Formato de saída pedido ao provedor. `'json'` é o default DELIBERADO: o
 * primeiro consumidor desta camada (`OpenAIDecisionProvider`) depende de
 * saída JSON e não pode regredir, então quem não declara `format` continua
 * recebendo exatamente o comportamento anterior a esta adição. `'text'`
 * existe para consumidores de prosa — o `responseProvider` somente-leitura
 * da NOVA (PR10.4) compõe resposta para humano, não estrutura de decisão.
 *
 * Ampliar o formato NÃO amplia a capacidade: este contrato continua sendo
 * "texto entra, texto sai", sem `tools`, sem Function Calling, sem qualquer
 * caminho pelo qual um provider possa propor execução de ação.
 */
export type LLMResponseFormat = 'json' | 'text';

/** Pedido de conclusão de texto — o Prompt Builder já entrega o prompt PRONTO; nenhum `LLMProvider` monta prompt sozinho. */
export interface LLMRequest {
  /** Prompt completo (Capabilities + UserContext + Memory Layer + mensagem atual), já montado por `PromptBuilder`. */
  prompt: string;
  /** Ausente = `'json'` — ver `LLMResponseFormat`. */
  format?: LLMResponseFormat;
}

/** Resposta crua do modelo — texto puro. Quem valida se é JSON válido no formato esperado é o Decision Engine (`parseLLMDecisionResponse`), nunca o `LLMProvider`. */
export interface LLMResponse {
  content: string;
}
