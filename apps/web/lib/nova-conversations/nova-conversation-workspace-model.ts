import type { ConversationMessage } from '@/components/nova/nova-message-bubble';
import type { NovaPersona } from '@/services/nova';
import type {
  NovaConversationTurnDto,
  NovaMessageDto,
  PersistTurnRequest,
  ProcessNovaMessageRequest,
} from './nova-conversation-api-client';

export type NovaHydrationStatus = 'idle' | 'loading' | 'ready' | 'error';
export type NovaMessagePersistence = 'persisted' | 'optimistic' | 'unsynced' | 'transient';

export type PendingConversationTurn = {
  clientTurnId: string;
  conversationId: string;
  persona: NovaPersona;
  requestGeneration: number;
  payload: PersistTurnRequest;
};

export type PendingOrchestratorTurn = {
  clientTurnId: string;
  conversationId: string;
  persona: NovaPersona;
  requestGeneration: number;
  payload: ProcessNovaMessageRequest;
};

export type NovaConversationCache = {
  conversationId: string | null;
  hydrationStatus: NovaHydrationStatus;
  nextCursor: string | null;
  hasMore: boolean;
  requestGeneration: number;
  pendingTurns: Record<string, PendingConversationTurn>;
  pendingOrchestratorTurns: Record<string, PendingOrchestratorTurn>;
  error: string | null;
  isThinking: boolean;
  thinkingStatus: 'pensando' | 'executando';
  isCreatingConversation: boolean;
  isLoadingPrevious: boolean;
  lastMessageMutation: 'idle' | 'append' | 'hydrate' | 'prepend' | 'reconcile' | 'reset';
};

export const EMPTY_NOVA_CONVERSATION_CACHE: NovaConversationCache = {
  conversationId: null,
  hydrationStatus: 'idle',
  nextCursor: null,
  hasMore: false,
  requestGeneration: 0,
  pendingTurns: {},
  pendingOrchestratorTurns: {},
  error: null,
  isThinking: false,
  thinkingStatus: 'pensando',
  isCreatingConversation: false,
  isLoadingPrevious: false,
  lastMessageMutation: 'idle',
};

export function persistedMessageToConversationMessage(message: NovaMessageDto): ConversationMessage {
  return {
    id: message.id,
    role: message.role === 'USER' ? 'user' : 'nova',
    content: message.content,
    status: 'success',
    persistence: 'persisted',
  };
}

export function mergeHydratedMessages(current: ConversationMessage[], persisted: NovaMessageDto[]): ConversationMessage[] {
  const canonical = dedupeMessages(persisted.map(persistedMessageToConversationMessage));
  const transient = current.filter((message) => (message.persistence ?? 'transient') === 'transient');
  return [...canonical, ...transient];
}

export function prependPersistedMessages(current: ConversationMessage[], older: NovaMessageDto[]): ConversationMessage[] {
  const persistedCurrent = current.filter((message) => message.persistence !== 'transient');
  const transient = current.filter((message) => (message.persistence ?? 'transient') === 'transient');
  return [...dedupeMessages([...older.map(persistedMessageToConversationMessage), ...persistedCurrent]), ...transient];
}

export function reconcilePersistedTurn(
  current: ConversationMessage[],
  clientTurnId: string,
  turn: NovaConversationTurnDto
): ConversationMessage[] {
  const optimisticAssistant = current.find((message) => message.clientTurnId === clientTurnId && message.role === 'nova');
  const withoutOptimisticPair = current.filter((message) => message.clientTurnId !== clientTurnId);
  const transient = withoutOptimisticPair.filter((message) => (message.persistence ?? 'transient') === 'transient');
  const canonical = withoutOptimisticPair.filter((message) => (message.persistence ?? 'transient') !== 'transient');
  return [
    ...dedupeMessages([
      ...canonical,
      persistedMessageToConversationMessage(turn.user),
      {
        ...persistedMessageToConversationMessage(turn.assistant),
        ...(optimisticAssistant?.attachment ? { attachment: optimisticAssistant.attachment } : {}),
      },
    ]),
    ...transient,
  ];
}

export function markTurnUnsynced(current: ConversationMessage[], clientTurnId: string): ConversationMessage[] {
  return current.map((message) => message.clientTurnId === clientTurnId
    ? { ...message, persistence: 'unsynced' as const }
    : message);
}

export function isOperationCurrent(
  cache: NovaConversationCache,
  operation: Pick<PendingConversationTurn, 'conversationId' | 'requestGeneration'>
): boolean {
  return cache.conversationId === operation.conversationId
    && cache.requestGeneration === operation.requestGeneration;
}

export function buildPersistTurnRequest(clientTurnId: string, userContent: string, assistantContent: string): PersistTurnRequest {
  return {
    clientTurnId,
    user: { content: userContent },
    assistant: { content: assistantContent },
  };
}

export function buildProcessMessageRequest(clientTurnId: string, content: string): ProcessNovaMessageRequest {
  return { clientTurnId, content };
}

export function orchestratorMessagesToTurn(messages: readonly NovaMessageDto[]): NovaConversationTurnDto {
  const user = messages.find((message) => message.role === 'USER');
  const assistant = messages.find((message) => message.role === 'ASSISTANT');
  if (!user || !assistant) throw new Error('Resposta persistida do Orchestrator incompleta.');
  return { user, assistant };
}

function dedupeMessages(messages: ConversationMessage[]): ConversationMessage[] {
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
}
