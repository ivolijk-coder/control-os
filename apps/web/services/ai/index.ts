/**
 * Ponto único de importação da camada de IA (CONTROL OS — Etapa 4:
 * Preparação profissional para OpenAI GPT-5.5). Telas/consumidores
 * importam só daqui — nunca de `providers/`, `actions/` ou `tools/`
 * diretamente.
 *
 * `AI_PROVIDER=mock` (padrão) continua 100% offline, determinístico, sem
 * custo. `AI_PROVIDER=openai` liga `OpenAIProvider`, que só fala com a
 * OpenAI através de `app/api/ai/nova/route.ts` (server-only) — nenhuma
 * tela, nenhum componente client, conversa diretamente com a OpenAI.
 */
export { ConversationService } from './conversation';
export { getAIProvider, AI_PROVIDER } from './config';
export { MockAIProvider } from './providers/MockAIProvider';
export { OpenAIProvider } from './providers/OpenAIProvider';
export { AIProviderError, AI_ERROR_FRIENDLY_MESSAGES } from './errors';
export type { AIProviderErrorCode } from './errors';
export { buildModelContextSummary } from './context/buildModelContext';
export { shouldCondense, KEEP_RECENT_TURNS } from './memory/condense-conversation';
export type { ConversationTurnLike } from './memory/condense-conversation';
export { INTENT_TOOL_SCHEMAS } from './tools/schemas';
export type { ToolSchema, ToolSchemaProperty } from './tools/schemas';
export type { AIProvider } from './interfaces';
export type {
  AIConversationContext,
  AIExtractedEntities,
  AIProviderName,
  ChatMessage,
  NovaAIRequestBody,
  NovaAIRequestMode,
  NovaAIResponseBody,
  NovaAIToolCall,
} from './types';
