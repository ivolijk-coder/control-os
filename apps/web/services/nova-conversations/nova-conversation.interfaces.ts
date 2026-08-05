import type {
  MessagePage,
  NovaConversation,
  NovaConversationChannel,
  NovaConversationPersona,
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

export interface NovaConversationRepository {
  getOrCreateActive(scope: ConversationScope & { activeKey: string }): Promise<NovaConversation>;
  closeActive(scope: ConversationScope, closedAt: Date): Promise<NovaConversation | null>;
  markDeleted(input: { userId: string; conversationId: string; deletedAt: Date }): Promise<boolean>;
  listConversations(input: { userId: string; limit: number }): Promise<NovaConversation[]>;
  appendMessageAtomically(input: AppendMessageInput): Promise<{ message: NovaMessage; replayed: boolean }>;
  listMessages(input: { userId: string; conversationId: string; limit: number; beforeSequence?: string }): Promise<MessagePage>;
}
export interface NovaConversationService {
  getOrCreateActive(scope: ConversationScope): Promise<NovaConversation>;
  closeActive(scope: ConversationScope): Promise<NovaConversation | null>;
  deleteConversation(input: { userId: string; conversationId: string }): Promise<boolean>;
  listConversations(input: { userId: string; limit?: number }): Promise<NovaConversation[]>;
  appendMessage(input: Omit<AppendMessageInput, 'redacted'>): Promise<{ message: NovaMessage; replayed: boolean }>;
  listMessages(input: { userId: string; conversationId: string; limit?: number; cursor?: string }): Promise<MessagePage>;
}
