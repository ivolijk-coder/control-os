/**
 * Ponto único de importação da camada LLM (CONTROL HUB — Fase 5). Mesma
 * convenção de `services/memory/index.ts`, `services/context-provider/index.ts`
 * e `services/action-engine/index.ts` — consumidores importam só daqui.
 */
export type { LLMProvider } from './llm.interfaces';
export type { LLMRequest, LLMResponse, LLMResponseFormat } from './llm.types';
export { LLMProviderError } from './errors';
export type { LLMProviderErrorCode } from './errors';
export { MockLLMProvider } from './providers/mock-llm-provider';
export { OpenAILLMProvider } from './providers/openai-llm-provider';
