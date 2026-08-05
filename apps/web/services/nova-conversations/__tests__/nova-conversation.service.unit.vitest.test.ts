import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { NovaConversationServiceImpl } from '../nova-conversation.service';
import type { AppendMessageInput, ConversationScope, NovaConversationRepository } from '../nova-conversation.interfaces';
import type { MessagePage, NovaConversation, NovaMessage } from '../nova-conversation.types';
import { REDACTED_CONTENT, sanitizeConversationContent } from '../conversation-content-sanitizer';

class InMemoryConversationRepository implements NovaConversationRepository {
  conversations: NovaConversation[] = [];
  messages: NovaMessage[] = [];
  sequence = 0;
  failNextAppend = false;

  async getOrCreateActive(input: ConversationScope & { activeKey: string }): Promise<NovaConversation> {
    const existing = this.conversations.find((item) =>
      item.userId === input.userId && item.channel === input.channel && item.persona === input.persona
      && item.status === 'ACTIVE' && item.deletedAt === null
    );
    if (existing) return existing;
    const now = new Date();
    const created: NovaConversation = {
      id: `conversation-${this.conversations.length + 1}`,
      userId: input.userId,
      channel: input.channel,
      persona: input.persona,
      status: 'ACTIVE',
      startedAt: now,
      lastMessageAt: now,
      closedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.push(created);
    return created;
  }

  async closeActive(scope: ConversationScope, closedAt: Date): Promise<NovaConversation | null> {
    const item = this.conversations.find((candidate) => candidate.userId === scope.userId && candidate.channel === scope.channel
      && candidate.persona === scope.persona && candidate.status === 'ACTIVE' && candidate.deletedAt === null);
    if (!item) return null;
    item.status = 'CLOSED';
    item.closedAt = closedAt;
    item.updatedAt = closedAt;
    return item;
  }

  async markDeleted(input: { userId: string; conversationId: string; deletedAt: Date }): Promise<boolean> {
    const item = this.conversations.find((candidate) => candidate.id === input.conversationId && candidate.userId === input.userId && candidate.deletedAt === null);
    if (!item) return false;
    item.deletedAt = input.deletedAt;
    item.status = 'ARCHIVED';
    return true;
  }

  async listConversations(input: { userId: string; limit: number }): Promise<NovaConversation[]> {
    return this.conversations.filter((item) => item.userId === input.userId && item.deletedAt === null).slice(0, input.limit);
  }

  async appendMessageAtomically(input: AppendMessageInput): Promise<{ message: NovaMessage; replayed: boolean }> {
    const existing = this.messages.find((item) => item.conversationId === input.conversationId && item.userId === input.userId
      && item.correlationId === input.correlationId && item.role === input.role);
    if (existing) return { message: existing, replayed: true };
    const conversation = this.conversations.find((item) => item.id === input.conversationId && item.userId === input.userId
      && item.status === 'ACTIVE' && item.deletedAt === null);
    if (!conversation) throw new Error('NOVA_CONVERSATION_NOT_FOUND');
    if (this.failNextAppend) {
      this.failNextAppend = false;
      throw new Error('SYNTHETIC_TRANSACTION_FAILURE');
    }
    this.sequence += 1;
    const createdAt = new Date(Date.now() + this.sequence);
    const message: NovaMessage = {
      id: `message-${this.sequence}`,
      conversationId: input.conversationId,
      userId: input.userId,
      role: input.role,
      content: input.content,
      intent: input.intent ?? null,
      provider: input.provider ?? null,
      providerResponseId: input.providerResponseId ?? null,
      correlationId: input.correlationId,
      sequence: String(this.sequence),
      redacted: input.redacted,
      createdAt,
    };
    this.messages.push(message);
    conversation.lastMessageAt = createdAt;
    return { message, replayed: false };
  }

  async listMessages(input: { userId: string; conversationId: string; limit: number; beforeSequence?: string }): Promise<MessagePage> {
    const conversation = this.conversations.find((item) => item.id === input.conversationId && item.userId === input.userId && item.deletedAt === null);
    if (!conversation) return { messages: [], nextCursor: null };
    const filtered = this.messages.filter((item) => item.userId === input.userId && item.conversationId === input.conversationId
      && (!input.beforeSequence || BigInt(item.sequence) < BigInt(input.beforeSequence)));
    const page = filtered.slice(-input.limit);
    return { messages: page, nextCursor: filtered.length > page.length ? page[0]?.sequence ?? null : null };
  }
}

describe('NovaConversationService — fundacao persistente', () => {
  let repository: InMemoryConversationRepository;
  let service: NovaConversationServiceImpl;

  beforeEach(() => {
    repository = new InMemoryConversationRepository();
    service = new NovaConversationServiceImpl(repository);
  });

  it('isola leitura e escrita por userId', async () => {
    const conversation = await service.getOrCreateActive({ userId: 'user-a', channel: 'WEB', persona: 'NOVA' });
    await expect(service.appendMessage({ userId: 'user-b', conversationId: conversation.id, role: 'USER', content: 'ola', correlationId: 'turn-1' }))
      .rejects.toThrow('NOVA_CONVERSATION_NOT_FOUND');
    await service.appendMessage({ userId: 'user-a', conversationId: conversation.id, role: 'USER', content: 'ola', correlationId: 'turn-1' });
    await expect(service.listMessages({ userId: 'user-b', conversationId: conversation.id })).resolves.toEqual({ messages: [], nextCursor: null });
  });

  it('duas criacoes concorrentes devolvem uma unica conversa ativa', async () => {
    const scope = { userId: 'user-a', channel: 'WEB' as const, persona: 'NOVA' as const };
    const [first, second] = await Promise.all([service.getOrCreateActive(scope), service.getOrCreateActive(scope)]);
    expect(first.id).toBe(second.id);
    expect(repository.conversations).toHaveLength(1);
  });

  it('mantem mensagens em ordem por sequence', async () => {
    const conversation = await service.getOrCreateActive({ userId: 'user-a', channel: 'WEB', persona: 'NOVA' });
    await service.appendMessage({ userId: 'user-a', conversationId: conversation.id, role: 'USER', content: 'primeira', correlationId: 'turn-1' });
    await service.appendMessage({ userId: 'user-a', conversationId: conversation.id, role: 'ASSISTANT', content: 'segunda', correlationId: 'turn-1' });
    const page = await service.listMessages({ userId: 'user-a', conversationId: conversation.id });
    expect(page.messages.map((item) => [item.sequence, item.content])).toEqual([['1', 'primeira'], ['2', 'segunda']]);
  });

  it('trata replay por correlationId e role sem duplicar', async () => {
    const conversation = await service.getOrCreateActive({ userId: 'user-a', channel: 'WEB', persona: 'NOVA' });
    const input = { userId: 'user-a', conversationId: conversation.id, role: 'USER' as const, content: 'mensagem', correlationId: 'turn-1' };
    const first = await service.appendMessage(input);
    const replay = await service.appendMessage(input);
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.message.id).toBe(first.message.id);
    expect(repository.messages).toHaveLength(1);
  });

  it('separa NOVA de LEGENDARY e WEB de WHATSAPP', async () => {
    const novaWeb = await service.getOrCreateActive({ userId: 'user-a', channel: 'WEB', persona: 'NOVA' });
    const legendaryWeb = await service.getOrCreateActive({ userId: 'user-a', channel: 'WEB', persona: 'LEGENDARY' });
    const novaWhatsapp = await service.getOrCreateActive({ userId: 'user-a', channel: 'WHATSAPP', persona: 'NOVA' });
    expect(new Set([novaWeb.id, legendaryWeb.id, novaWhatsapp.id]).size).toBe(3);
  });

  it('redige deterministicamente credenciais e marca a mensagem', async () => {
    const conversation = await service.getOrCreateActive({ userId: 'user-a', channel: 'WEB', persona: 'NOVA' });
    const result = await service.appendMessage({
      userId: 'user-a', conversationId: conversation.id, role: 'USER', correlationId: 'turn-secret',
      content: 'senha: caso123 token=abc123456789 Bearer abcdefghijklmnop API_KEY=sk-abcdefghijklmnop',
    });
    expect(result.message.redacted).toBe(true);
    expect(result.message.content).not.toContain('caso123');
    expect(result.message.content).not.toContain('abcdefghijklmnop');
    expect(result.message.content).toContain(REDACTED_CONTENT);
  });

  it('remove chave privada completa e limita tamanho', () => {
    const privateKey = '-----BEGIN PRIVATE KEY-----\nsegredo\n-----END PRIVATE KEY-----';
    const result = sanitizeConversationContent(`${privateKey}${'x'.repeat(21_000)}`);
    expect(result.redacted).toBe(true);
    expect(result.content).not.toContain('segredo');
    expect(result.content.length).toBeLessThanOrEqual(20_000);
  });

  it('nao conversa com a camada de memoria', async () => {
    const conversation = await service.getOrCreateActive({ userId: 'user-a', channel: 'WEB', persona: 'NOVA' });
    await service.appendMessage({ userId: 'user-a', conversationId: conversation.id, role: 'USER', content: 'Meu objetivo e crescer.', correlationId: 'turn-memory' });
    expect(repository.messages).toHaveLength(1);
    expect(repository.messages[0]?.content).toBe('Meu objetivo e crescer.');
  });

  it('falha transacional nao deixa mensagem nem lastMessageAt parcial', async () => {
    const conversation = await service.getOrCreateActive({ userId: 'user-a', channel: 'WEB', persona: 'NOVA' });
    const previousLastMessageAt = conversation.lastMessageAt;
    repository.failNextAppend = true;
    await expect(service.appendMessage({ userId: 'user-a', conversationId: conversation.id, role: 'USER', content: 'falha', correlationId: 'turn-fail' }))
      .rejects.toThrow('SYNTHETIC_TRANSACTION_FAILURE');
    expect(repository.messages).toHaveLength(0);
    expect(conversation.lastMessageAt).toEqual(previousLastMessageAt);
  });

  it('deletedAt torna conversa indisponivel para leitura e escrita normais', async () => {
    const conversation = await service.getOrCreateActive({ userId: 'user-a', channel: 'WEB', persona: 'NOVA' });
    await service.appendMessage({ userId: 'user-a', conversationId: conversation.id, role: 'USER', content: 'antes', correlationId: 'turn-before-delete' });
    await expect(service.deleteConversation({ userId: 'user-a', conversationId: conversation.id })).resolves.toBe(true);
    await expect(service.listMessages({ userId: 'user-a', conversationId: conversation.id })).resolves.toEqual({ messages: [], nextCursor: null });
    await expect(service.appendMessage({ userId: 'user-a', conversationId: conversation.id, role: 'USER', content: 'depois', correlationId: 'turn-after-delete' }))
      .rejects.toThrow('NOVA_CONVERSATION_NOT_FOUND');
  });
});
