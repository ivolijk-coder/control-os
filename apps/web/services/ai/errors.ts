/**
 * Erros da camada de IA (CONTROL OS — Etapa 4: Preparação profissional para
 * OpenAI GPT-5.5). Cobre exatamente os casos pedidos: timeout, rate limit,
 * API indisponível, resposta inválida, tool inexistente, JSON inválido,
 * tool interrompida. `MockAIProvider` nunca lança nada disto (é
 * determinístico, sem rede); só `OpenAIProvider`/a Route Handler produzem
 * esses erros de verdade.
 */
export type AIProviderErrorCode =
  | 'timeout'
  | 'rate_limit'
  | 'unavailable'
  | 'invalid_response'
  | 'tool_not_found'
  | 'invalid_json'
  | 'tool_interrupted';

/** Mensagem amigável — nunca expõe detalhe técnico (status HTTP, stack) pro usuário final. */
export const AI_ERROR_FRIENDLY_MESSAGES: Record<AIProviderErrorCode, string> = {
  timeout: 'A NOVA demorou demais pra responder. Pode tentar de novo?',
  rate_limit: 'A NOVA está recebendo muitas mensagens agora. Espera um instante e tenta de novo.',
  unavailable: 'A NOVA está temporariamente indisponível. Tenta de novo em instantes.',
  invalid_response: 'A NOVA recebeu uma resposta que não conseguiu entender. Pode reformular?',
  tool_not_found: 'A NOVA tentou usar uma ferramenta que não existe. Isso é um bug — já registrei o ocorrido.',
  invalid_json: 'A NOVA recebeu uma resposta mal formatada. Pode tentar de novo?',
  tool_interrupted: 'A ação foi interrompida antes de terminar. Nada foi alterado — pode tentar de novo.',
};

/**
 * Lançado por `OpenAIProvider` (e capturado sempre por `ConversationService`
 * — nunca deixado propagar como uma `Promise` rejeitada sem tratamento até
 * a UI). Guarda o `code` para telemetria/logs e a mensagem amigável pronta
 * para exibir.
 */
export class AIProviderError extends Error {
  readonly code: AIProviderErrorCode;

  constructor(code: AIProviderErrorCode, detail?: string) {
    super(detail ?? AI_ERROR_FRIENDLY_MESSAGES[code]);
    this.name = 'AIProviderError';
    this.code = code;
  }

  get friendlyMessage(): string {
    return AI_ERROR_FRIENDLY_MESSAGES[this.code];
  }
}
