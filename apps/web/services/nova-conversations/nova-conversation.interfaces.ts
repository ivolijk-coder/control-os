import type {
  ConversationCursor,
  ConversationPage,
  MessagePage,
  NovaConversation,
  NovaConversationChannel,
  NovaConversationPersona,
  NovaConversationTurn,
  NovaMessage,
  NovaMessageRole,
} from './nova-conversation.types';

export type ConversationScope = {
  userId: string;
  channel: NovaConversationChannel;
  persona: NovaConversationPersona;
};

export type AppendMessageInput = {
  userId: string;
  conversationId: string;
  role: NovaMessageRole;
  content: string;
  correlationId: string;
  redacted: boolean;
  intent?: string;
  provider?: string;
  providerResponseId?: string;
};

export type PersistConversationTurnInput = {
  userId: string;
  conversationId: string;
  channel: NovaConversationChannel;
  correlationId: string;
  user: {
    content: string;
    redacted: boolean;
    intent?: string;
  };
  assistant: {
    content: string;
    redacted: boolean;
    intent?: string;
  };
};

export interface NovaConversationRepository {
  getOrCreateActive(scope: ConversationScope & { activeKey: string }): Promise<NovaConversation>;
  closeActive(scope: ConversationScope, closedAt: Date): Promise<NovaConversation | null>;
  closeConversation(input: { userId: string; conversationId: string; channel: NovaConversationChannel; closedAt: Date }): Promise<NovaConversation | null>;
  markDeleted(input: { userId: string; conversationId: string; deletedAt: Date }): Promise<boolean>;
  listConversations(input: {
    userId: string;
    channel: NovaConversationChannel;
    persona: NovaConversationPersona;
    limit: number;
    cursor?: ConversationCursor;
  }): Promise<ConversationPage>;
  appendMessageAtomically(input: AppendMessageInput): Promise<{ message: NovaMessage; replayed: boolean }>;
  persistTurnAtomically(input: PersistConversationTurnInput): Promise<{ turn: NovaConversationTurn; replayed: boolean } | null>;
  listMessages(input: {
    userId: string;
    conversationId: string;
    channel: NovaConversationChannel;
    limit: number;
    beforeSequence?: string;
  }): Promise<MessagePage | null>;
}
export interface NovaConversationService {
  getOrCreateActive(scope: ConversationScope): Promise<NovaConversation>;
  closeActive(scope: ConversationScope): Promise<NovaConversation | null>;
  closeConversation(input: { userId: string; conversationId: string; channel: NovaConversationChannel }): Promise<NovaConversation | null>;
  deleteConversation(input: { userId: string; conversationId: string }): Promise<boolean>;
  listConversations(input: {
    userId: string;
    channel: NovaConversationChannel;
    persona: NovaConversationPersona;
    limit?: number;
    cursor?: ConversationCursor;
  }): Promise<ConversationPage>;
  appendMessage(input: Omit<AppendMessageInput, 'redacted'>): Promise<{ message: NovaMessage; replayed: boolean }>;
  persistTurn(input: Omit<PersistConversationTurnInput, 'user' | 'assistant'> & {
    user: Omit<PersistConversationTurnInput['user'], 'redacted'>;
    assistant: Omit<PersistConversationTurnInput['assistant'], 'redacted'>;
  }): Promise<{ turn: NovaConversationTurn; replayed: boolean } | null>;
  listMessages(input: {
    userId: string;
    conversationId: string;
    channel: NovaConversationChannel;
    limit?: number;
    cursor?: string;
  }): Promise<MessagePage | null>;
}
