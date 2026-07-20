/**
 * Erros de `LLMProvider` — mesmo espírito de `services/ai/errors.ts`
 * (`AIProviderError`), mas um tipo PRÓPRIO, não reaproveitado: aquele erro é
 * do pipeline de conversa antigo (carrega códigos específicos de Tool
 * Calling — `tool_not_found`, `tool_interrupted` — que não existem aqui,
 * "não implementar Function Calling nesta etapa"). Este cobre só o que um
 * `LLMProvider` genérico (texto entra, texto sai) pode falhar.
 *
 * Nunca escapa cru para fora de `services/decision-engine`:
 * `OpenAIDecisionProvider` sempre captura isto e devolve um `DecisionResult`
 * seguro (`kind: 'reply'`) — "nunca lançar exceção não tratada", exatamente
 * como pedido.
 */
export type LLMProviderErrorCode = 'unavailable' | 'timeout' | 'rate_limit' | 'invalid_response';

export class LLMProviderError extends Error {
  readonly code: LLMProviderErrorCode;

  constructor(code: LLMProviderErrorCode, detail?: string) {
    super(detail ?? code);
    this.name = 'LLMProviderError';
    this.code = code;
  }
}
