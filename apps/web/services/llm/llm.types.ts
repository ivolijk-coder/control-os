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

/** Pedido de conclusão de texto — o Prompt Builder já entrega o prompt PRONTO; nenhum `LLMProvider` monta prompt sozinho. */
export interface LLMRequest {
  /** Prompt completo (Capabilities + UserContext + Memory Layer + mensagem atual), já montado por `PromptBuilder`. */
  prompt: string;
}

/** Resposta crua do modelo — texto puro. Quem valida se é JSON válido no formato esperado é o Decision Engine (`parseLLMDecisionResponse`), nunca o `LLMProvider`. */
export interface LLMResponse {
  content: string;
}
