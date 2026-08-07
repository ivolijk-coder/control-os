import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  DEFAULT_CONVERSATION_PAGE_LIMIT,
  encodeConversationCursor,
  encodeMessageCursor,
  MAX_CONVERSATION_PAGE_LIMIT,
  parseConversationCursor,
  parseMessageCursor,
  parsePageLimit,
  toPublicConversation,
  toPublicMessage,
} from '../nova-conversation-api';
import type { NovaConversation, NovaMessage } from '../nova-conversation.types';

const conversationId = '11111111-1111-4111-8111-111111111111';
const otherConversationId = '22222222-2222-4222-8222-222222222222';

describe('contratos públicos das conversas da NOVA', () => {
  it('usa limite padrão 30, aceita 100 e rejeita valores fora do contrato', () => {
    expect(parsePageLimit(null)).toBe(DEFAULT_CONVERSATION_PAGE_LIMIT);
    expect(parsePageLimit('100')).toBe(MAX_CONVERSATION_PAGE_LIMIT);
    expect(() => parsePageLimit('101')).toThrow('entre 1 e 100');
    expect(() => parsePageLimit('0')).toThrow('Limite inválido');
    expect(() => parsePageLimit('1.5')).toThrow('Limite inválido');
  });

  it('codifica cursor de conversa versionado com data e ID', () => {
    const cursor = { id: conversationId, lastMessageAt: new Date('2026-08-07T12:34:56.000Z') };
    expect(parseConversationCursor(encodeConversationCursor(cursor))).toEqual(cursor);
    expect(() => parseConversationCursor('invalido')).toThrow('Cursor inválido');
  });

  it('vincula cursor de mensagens à conversa correta', () => {
    const cursor = encodeMessageCursor(conversationId, '42');
    expect(parseMessageCursor(cursor, conversationId)).toBe('42');
    expect(() => parseMessageCursor(cursor, otherConversationId)).toThrow('Cursor inválido');
  });

  it('remove todos os campos internos dos DTOs públicos', () => {
    const now = new Date('2026-08-07T12:00:00.000Z');
    const conversation: NovaConversation = {
      id: conversationId,
      userId: 'user-secret',
      channel: 'WEB',
      persona: 'NOVA',
      status: 'ACTIVE',
      startedAt: now,
      lastMessageAt: now,
      closedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const message: NovaMessage = {
      id: '33333333-3333-4333-8333-333333333333',
      conversationId,
      userId: 'user-secret',
      role: 'ASSISTANT',
      content: 'Resposta segura',
      intent: 'FINANCIAL_STATUS',
      provider: 'internal-provider',
      providerResponseId: 'provider-secret',
      correlationId: 'correlation-secret',
      sequence: '99',
      redacted: false,
      createdAt: now,
    };

    const conversationJson = JSON.stringify(toPublicConversation(conversation));
    const messageJson = JSON.stringify(toPublicMessage(message));
    for (const internal of ['userId', 'deletedAt', 'updatedAt', 'activeKey']) expect(conversationJson).not.toContain(internal);
    for (const internal of ['userId', 'conversationId', 'provider', 'providerResponseId', 'correlationId', 'sequence']) {
      expect(messageJson).not.toContain(internal);
    }
  });
});
