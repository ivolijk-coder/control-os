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
 *
 * NOVA CORE (CONTROL OS — Etapa 6: IA-Native) — este arquivo, junto com
 * `services/nova/index.ts`, É a NOVA CORE: a camada conceitual que
 * centraliza toda a inteligência do sistema. Não é um módulo novo, é o
 * nome dado à arquitetura que já existe desde a Etapa 4/5 —
 * `ConversationService` (exportado abaixo) é o único ponto de entrada de
 * qualquer canal (`NovaWorkspace` hoje; WhatsApp/Telegram amanhã, todos
 * via `sessionId`), e é ele quem fala com `OpenAIProvider`/
 * `MockAIProvider`, resolve intenção (`IntentResolver`, em
 * `services/ai/conversation`) e executa (`ActionExecutor`). Nenhuma tela e
 * nenhum módulo de domínio (financeiro, agenda, hábitos, metas, projetos,
 * viagens, documentos, patrimônio, notas, missões) conversa com outro
 * diretamente — todos só leem/escrevem no mesmo `useDataStore`, e é a
 * NOVA CORE quem decide o que fazer com esses dados em nome do usuário.
 * Trocar o modelo por trás (GPT-5.5 → GPT-6 → outro provedor) é trocar só
 * `OpenAIProvider`/`OPENAI_MODEL` — a NOVA CORE (identidade, regras,
 * execução) não muda: o modelo é o motor, a NOVA é quem dirige.
 */
export { ConversationService, conversationService } from './conversation';
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
export type { AIProvider, ProposedToolCall, ReasoningProvider, ReasoningTurn, ToolExecutionOutput } from './interfaces';
export type {
  AIConversationContext,
  AIExtractedEntities,
  AIProviderName,
  ChatMessage,
  NovaAIRequestBody,
  NovaAIRequestMode,
  NovaAIResponseBody,
  NovaAIToolCall,
  NovaAIToolOutput,
} from './types';
