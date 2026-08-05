import 'server-only';

import { createHash } from 'node:crypto';
import { sanitizeConversationContent } from './conversation-content-sanitizer';
import type { AppendMessageInput, ConversationScope, NovaConversationRepository, NovaConversationService } from './nova-conversation.interfaces';
import { PrismaNovaConversationRepository } from './prisma-nova-conversation.repository';
import type { MessagePage, NovaConversation, NovaMessage } from './nova-conversation.types';

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;

function requireValue(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} e obrigatorio.`);
  return normalized;
}

function activeKeyFor(scope: ConversationScope): string {
  return createHash('sha256')
    .update(`${scope.userId}\u0000${scope.channel}\u0000${scope.persona}`)
    .digest('hex');
}

function pageLimit(value: number | undefined): number {
  if (value === undefined) return DEFAULT_PAGE_LIMIT;
  if (!Number.isInteger(value) || value < 1 || value > MAX_PAGE_LIMIT) throw new Error('Limite de pagina invalido.');
  return value;
}

function cursor(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!/^[1-9][0-9]*$/u.test(value)) throw new Error('Cursor de mensagem invalido.');
  return value;
}

export class NovaConversationServiceImpl implements NovaConversationService {
  constructor(private readonly repository: NovaConversationRepository = new PrismaNovaConversationRepository()) {}

  getOrCreateActive(scope: ConversationScope): Promise<NovaConversation> {
    requireValue(scope.userId, 'userId');
    return this.repository.getOrCreateActive({ ...scope, activeKey: activeKeyFor(scope) });
  }

  closeActive(scope: ConversationScope): Promise<NovaConversation | null> {
    requireValue(scope.userId, 'userId');
    return this.repository.closeActive(scope, new Date());
  }

  deleteConversation(input: { userId: string; conversationId: string }): Promise<boolean> {
    return this.repository.markDeleted({
      userId: requireValue(input.userId, 'userId'),
      conversationId: requireValue(input.conversationId, 'conversationId'),
      deletedAt: new Date(),
    });
  }

  listConversations(input: { userId: string; limit?: number }): Promise<NovaConversation[]> {
    return this.repository.listConversations({ userId: requireValue(input.userId, 'userId'), limit: pageLimit(input.limit) });
  }

  appendMessage(input: Omit<AppendMessageInput, 'redacted'>): Promise<{ message: NovaMessage; replayed: boolean }> {
    const sanitized = sanitizeConversationContent(requireValue(input.content, 'content'));
    return this.repository.appendMessageAtomically({
      ...input,
      userId: requireValue(input.userId, 'userId'),
      conversationId: requireValue(input.conversationId, 'conversationId'),
      correlationId: requireValue(input.correlationId, 'correlationId'),
      content: sanitized.content,
      redacted: sanitized.redacted,
    });
  }

  listMessages(input: { userId: string; conversationId: string; limit?: number; cursor?: string }): Promise<MessagePage> {
    return this.repository.listMessages({
      userId: requireValue(input.userId, 'userId'),
      conversationId: requireValue(input.conversationId, 'conversationId'),
      limit: pageLimit(input.limit),
      beforeSequence: cursor(input.cursor),
    });
  }
}

export const novaConversationService: NovaConversationService = new NovaConversationServiceImpl();
