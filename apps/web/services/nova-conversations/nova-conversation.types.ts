export type NovaConversationChannel = 'WEB' | 'APP' | 'WHATSAPP' | 'API';
export type NovaConversationPersona = 'NOVA' | 'LEGENDARY';
export type NovaConversationStatus = 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
export type NovaMessageRole = 'USER' | 'ASSISTANT';

export type NovaConversation = {
  id: string;
  userId: string;
  channel: NovaConversationChannel;
  persona: NovaConversationPersona;
  status: NovaConversationStatus;
  startedAt: Date;
  lastMessageAt: Date;
  closedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
export type NovaMessage = {
  id: string;
  conversationId: string;
  userId: string;
  role: NovaMessageRole;
  content: string;
  intent: string | null;
  provider: string | null;
  providerResponseId: string | null;
  correlationId: string;
  /** String decimal para permanecer serializavel em JSON sem perder precisao. */
  sequence: string;
  redacted: boolean;
  createdAt: Date;
};

export type ConversationCursor = {
  lastMessageAt: Date;
  id: string;
};

export type ConversationPage = {
  items: NovaConversation[];
  nextCursor: ConversationCursor | null;
  hasMore: boolean;
};

export type MessagePage = {
  messages: NovaMessage[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type NovaConversationTurn = {
  user: NovaMessage;
  assistant: NovaMessage;
};

export type SanitizedConversationContent = {
  content: string;
  redacted: boolean;
};
