/**
 * Ponto único de importação do Decision Engine com IA (CONTROL HUB — Fase
 * 5). Mesma convenção de `services/action-engine/index.ts`,
 * `services/memory/index.ts` etc. — consumidores (a composição raiz em
 * `services/control-hub/decision-engine.ts`, e testes) importam só daqui.
 */
export { ActionCapabilityRegistry, capabilityRegistry } from './capability-registry';
export type { CapabilityRegistry } from './capability-registry';
export { parseLLMDecisionResponse, MIN_CONFIDENCE_TO_EXECUTE } from './parse-llm-decision';
export { DecisionPromptBuilder } from './prompt-builder';
export type { PromptBuilder } from './prompt-builder';
export { MockDecisionProvider } from './mock-decision-provider';
export { OpenAIDecisionProvider } from './openai-decision-provider';
export { logDecisionEngineTiming } from './metrics';
export type { DecisionEngineTiming } from './metrics';
