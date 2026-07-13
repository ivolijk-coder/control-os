/**
 * Ponto único de importação da camada de IA (CONTROL OS — Preparação para
 * OpenAI GPT-5.5). Telas/consumidores importam só daqui — nunca de
 * `providers/`, `actions/` ou `tools/` diretamente.
 *
 * NÃO integrar a API ainda. NÃO usar API Key. NÃO fazer chamadas HTTP. NÃO
 * gerar custo. `AI_PROVIDER` é sempre `'mock'` nesta fase; `OpenAIProvider`
 * existe só como esqueleto (lança erro se instanciado e chamado).
 */
export { ConversationService } from './conversation';
export { getAIProvider, AI_PROVIDER } from './config';
export { MockAIProvider } from './providers/MockAIProvider';
export { OpenAIProvider } from './providers/OpenAIProvider';
export type { AIProvider } from './interfaces';
export type { AIConversationContext, AIExtractedEntities, AIProviderName, ChatMessage } from './types';
