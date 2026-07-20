import type { LLMRequest, LLMResponse } from './llm.types';

/**
 * "A OpenAI NÃO poderá ser utilizada diretamente pelo Decision Engine.
 * Criar uma abstração." Esta é essa abstração — o Decision Engine
 * (`services/decision-engine/openai-decision-provider.ts`) depende só desta
 * interface, nunca de `OpenAILLMProvider` diretamente (injeção por
 * construtor, mesmo padrão de toda a arquitetura desde a Fase 1).
 *
 * "Futuros provedores (Anthropic, Gemini, Ollama, Azure OpenAI...) devem
 * poder ser adicionados facilmente, sem alterar o restante do sistema" —
 * qualquer classe nova que implemente só este método (`AnthropicLLMProvider`,
 * `GeminiLLMProvider`...) é uma troca de UMA linha na composição raiz
 * (`services/decision-engine/index.ts` ou onde o provider é instanciado),
 * nunca uma mudança no Decision Engine, no Prompt Builder ou na validação.
 */
export interface LLMProvider {
  complete(request: LLMRequest): Promise<LLMResponse>;
}
