import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { NovaConversationServiceImpl } from '../nova-conversation.service';
import type { AppendMessageInput, ConversationScope, NovaConversationRepository, PersistConversationTurnInput } from '../nova-conversation.interfaces';
import type { ConversationPage, MessagePage, NovaConversation, NovaConversationTurn, NovaMessage } from '../nova-conversation.types';
import { REDACTED_CONTENT, sanitizeConversationContent } from '../conversation-content-sanitizer';

class InMemoryConversationRepository implements NovaConversationRepository {
  conversations: NovaConversation[] = [];
  messages: NovaMessage[] = [];
  sequence = 0;
  failNextAppend = false;
  failNextTurn = false;

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

  async closeConversation(input: Parameters<NovaConversationRepository['closeConversation']>[0]): Promise<NovaConversation | null> {
    const item = this.conversations.find((candidate) => candidate.id === input.conversationId
      && candidate.userId === input.userId && candidate.channel === input.channel
      && candidate.deletedAt === null && (candidate.status === 'ACTIVE' || candidate.status === 'CLOSED'));
    if (!item) return null;
    if (item.status === 'ACTIVE') {
      item.status = 'CLOSED';
      item.closedAt = input.closedAt;
      item.updatedAt = input.closedAt;
    }
    return item;
  }

  async markDeleted(input: { userId: string; conversationId: string; deletedAt: Date }): Promise<boolean> {
    const item = this.conversations.find((candidate) => candidate.id === input.conversationId && candidate.userId === input.userId && candidate.deletedAt === null);
    if (!item) return false;
    item.deletedAt = input.deletedAt;
    item.status = 'ARCHIVED';
    return true;
  }

  async listConversations(input: Parameters<NovaConversationRepository['listConversations']>[0]): Promise<ConversationPage> {
    const sorted = this.conversations
      .filter((item) => item.userId === input.userId && item.channel === input.channel
        && item.persona === input.persona && item.deletedAt === null
        && (!input.cursor || item.lastMessageAt < input.cursor.lastMessageAt
          || (item.lastMessageAt.getTime() === input.cursor.lastMessageAt.getTime() && item.id < input.cursor.id)))
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime() || b.id.localeCompare(a.id));
    const hasMore = sorted.length > input.limit;
    const items = sorted.slice(0, input.limit);
    const last = items.at(-1);
    return {
      items,
      hasMore,
      nextCursor: hasMore && last ? { id: last.id, lastMessageAt: last.lastMessageAt } : null,
    };
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

  async persistTurnAtomically(input: PersistConversationTurnInput): Promise<{ turn: NovaConversationTurn; replayed: boolean } | null> {
    const existingUser = this.messages.find((item) => item.conversationId === input.conversationId
      && item.userId === input.userId && item.correlationId === input.correlationId && item.role === 'USER');
    const existingAssistant = this.messages.find((item) => item.conversationId === input.conversationId
      && item.userId === input.userId && item.correlationId === input.correlationId && item.role === 'ASSISTANT');
    if (existingUser && existingAssistant) return { turn: { user: existingUser, assistant: existingAssistant }, replayed: true };
    const conversation = this.conversations.find((item) => item.id === input.conversationId && item.userId === input.userId
      && item.channel === input.channel && item.status === 'ACTIVE' && item.deletedAt === null);
    if (!conversation) return null;
    if (this.failNextTurn) {
      this.failNextTurn = false;
      throw new Error('SYNTHETIC_TURN_TRANSACTION_FAILURE');
    }

    const originalSequence = this.sequence;
    const originalLastMessageAt = conversation.lastMessageAt;
    try {
      const makeMessage = (role: NovaMessage['role'], value: PersistConversationTurnInput['user']): NovaMessage => {
        this.sequence += 1;
        return {
          id: `message-${this.sequence}`,
          conversationId: input.conversationId,
          userId: input.userId,
          role,
          content: value.content,
          intent: value.intent ?? null,
          provider: null,
          providerResponseId: null,
          correlationId: input.correlationId,
          sequence: String(this.sequence),
          redacted: value.redacted,
          createdAt: new Date(Date.now() + this.sequence),
        };
      };
      const user = makeMessage('USER', input.user);
      const assistant = makeMessage('ASSISTANT', input.assistant);
      this.messages.push(user, assistant);
      conversation.lastMessageAt = assistant.createdAt;
      return { turn: { user, assistant }, replayed: false };
    } catch (error) {
      this.sequence = originalSequence;
      conversation.lastMessageAt = originalLastMessageAt;
      throw error;
    }
  }

  async listMessages(input: Parameters<NovaConversationRepository['listMessages']>[0]): Promise<MessagePage | null> {
    const conversation = this.conversations.find((item) => item.id === input.conversationId && item.userId === input.userId
      && item.channel === input.channel && item.deletedAt === null);
    if (!conversation) return null;
    const filtered = this.messages.filter((item) => item.userId === input.userId && item.conversationId === input.conversationId
      && (!input.beforeSequence || BigInt(item.sequence) < BigInt(input.beforeSequence)));
    const page = filtered.slice(-input.limit);
    const hasMore = filtered.length > page.length;
    return { messages: page, hasMore, nextCursor: hasMore ? page[0]?.sequence ?? null : null };
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
    await expect(service.listMessages({ userId: 'user-b', conversationId: conversation.id, channel: 'WEB' })).resolves.toBeNull();
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
    const page = await service.listMessages({ userId: 'user-a', conversationId: conversation.id, channel: 'WEB' });
    expect(page).not.toBeNull();
    expect(page?.messages.map((item) => [item.sequence, item.content])).toEqual([['1', 'primeira'], ['2', 'segunda']]);
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

  it('fecha somente o ID solicitado, aceita replay e cria uma nova ACTIVE depois', async () => {
    const nova = await service.getOrCreateActive({ userId: 'user-a', channel: 'WEB', persona: 'NOVA' });
    const legendary = await service.getOrCreateActive({ userId: 'user-a', channel: 'WEB', persona: 'LEGENDARY' });
    const closed = await service.closeConversation({ userId: 'user-a', conversationId: nova.id, channel: 'WEB' });
    const replay = await service.closeConversation({ userId: 'user-a', conversationId: nova.id, channel: 'WEB' });
    expect(closed?.status).toBe('CLOSED');
    expect(replay?.id).toBe(nova.id);
    expect(legendary.status).toBe('ACTIVE');
    const next = await service.getOrCreateActive({ userId: 'user-a', channel: 'WEB', persona: 'NOVA' });
    expect(next.id).not.toBe(nova.id);
    expect(next.status).toBe('ACTIVE');
  });

  it('não fecha conversa estrangeira nem conversa de outro canal', async () => {
    const conversation = await service.getOrCreateActive({ userId: 'user-a', channel: 'WEB', persona: 'NOVA' });
    await expect(service.closeConversation({ userId: 'user-b', conversationId: conversation.id, channel: 'WEB' })).resolves.toBeNull();
    await expect(service.closeConversation({ userId: 'user-a', conversationId: conversation.id, channel: 'WHATSAPP' })).resolves.toBeNull();
    expect(conversation.status).toBe('ACTIVE');
  });

  it('pagina conversas por lastMessageAt e ID sem repetir datas iguais', async () => {
    const sharedDate = new Date('2026-08-07T12:00:00.000Z');
    repository.conversations.push(
      { ...conversationShape('conversation-c', 'user-a', 'NOVA'), lastMessageAt: sharedDate },
      { ...conversationShape('conversation-b', 'user-a', 'NOVA'), lastMessageAt: sharedDate },
      { ...conversationShape('conversation-a', 'user-a', 'NOVA'), lastMessageAt: sharedDate },
      { ...conversationShape('conversation-other', 'user-b', 'NOVA'), lastMessageAt: sharedDate },
    );
    const first = await service.listConversations({ userId: 'user-a', channel: 'WEB', persona: 'NOVA', limit: 2 });
    const second = await service.listConversations({
      userId: 'user-a', channel: 'WEB', persona: 'NOVA', limit: 2, cursor: first.nextCursor ?? undefined,
    });
    expect(first.items.map((item) => item.id)).toEqual(['conversation-c', 'conversation-b']);
    expect(first.hasMore).toBe(true);
    expect(second.items.map((item) => item.id)).toEqual(['conversation-a']);
    expect(second.hasMore).toBe(false);
  });

  it('pagina mensagens antigas mantendo cada página em ordem cronológica', async () => {
    const conversation = await service.getOrCreateActive({ userId: 'user-a', channel: 'WEB', persona: 'NOVA' });
    for (let index = 1; index <= 5; index += 1) {
      await service.appendMessage({
        userId: 'user-a', conversationId: conversation.id, role: 'USER', content: `mensagem-${index}`, correlationId: `turn-${index}`,
      });
    }
    const newest = await service.listMessages({ userId: 'user-a', conversationId: conversation.id, channel: 'WEB', limit: 2 });
    const older = await service.listMessages({
      userId: 'user-a', conversationId: conversation.id, channel: 'WEB', limit: 2, cursor: newest?.nextCursor ?? undefined,
    });
    expect(newest?.messages.map((item) => item.content)).toEqual(['mensagem-4', 'mensagem-5']);
    expect(newest?.hasMore).toBe(true);
    expect(older?.messages.map((item) => item.content)).toEqual(['mensagem-2', 'mensagem-3']);
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

  it('persiste USER e ASSISTANT como um único turno ordenado e atualiza lastMessageAt', async () => {
    const conversation = await service.getOrCreateActive({ userId: 'user-a', channel: 'WEB', persona: 'NOVA' });
    const result = await service.persistTurn({
      userId: 'user-a', conversationId: conversation.id, channel: 'WEB', correlationId: 'client-turn-001',
      user: { content: 'Minha pergunta', intent: 'FINANCIAL_STATUS' },
      assistant: { content: 'Minha resposta' },
    });
    expect(result?.replayed).toBe(false);
    expect(result?.turn.user.role).toBe('USER');
    expect(result?.turn.assistant.role).toBe('ASSISTANT');
    expect(BigInt(result!.turn.user.sequence)).toBeLessThan(BigInt(result!.turn.assistant.sequence));
    expect(conversation.lastMessageAt).toEqual(result?.turn.assistant.createdAt);
    expect(repository.messages).toHaveLength(2);
  });

  it('replay sequencial devolve exatamente o mesmo par sem duplicar', async () => {
    const conversation = await service.getOrCreateActive({ userId: 'user-a', channel: 'WEB', persona: 'NOVA' });
    const input = {
      userId: 'user-a', conversationId: conversation.id, channel: 'WEB' as const, correlationId: 'client-turn-replay',
      user: { content: 'Pergunta original' }, assistant: { content: 'Resposta original' },
    };
    const first = await service.persistTurn(input);
    const replay = await service.persistTurn({ ...input, user: { content: 'Texto alterado' }, assistant: { content: 'Outro texto' } });
    expect(replay?.replayed).toBe(true);
    expect(replay?.turn).toEqual(first?.turn);
    expect(repository.messages).toHaveLength(2);
  });

  it('isola ownership, canal e soft delete na persistência do turno', async () => {
    const conversation = await service.getOrCreateActive({ userId: 'user-a', channel: 'WEB', persona: 'NOVA' });
    const base = { conversationId: conversation.id, correlationId: 'client-turn-isolation', user: { content: 'A' }, assistant: { content: 'B' } };
    await expect(service.persistTurn({ ...base, userId: 'user-b', channel: 'WEB' })).resolves.toBeNull();
    await expect(service.persistTurn({ ...base, userId: 'user-a', channel: 'WHATSAPP' })).resolves.toBeNull();
    await service.deleteConversation({ userId: 'user-a', conversationId: conversation.id });
    await expect(service.persistTurn({ ...base, userId: 'user-a', channel: 'WEB' })).resolves.toBeNull();
    expect(repository.messages).toHaveLength(0);
  });

  it('redige conteúdo sensível nos dois lados do turno', async () => {
    const conversation = await service.getOrCreateActive({ userId: 'user-a', channel: 'WEB', persona: 'NOVA' });
    const result = await service.persistTurn({
      userId: 'user-a', conversationId: conversation.id, channel: 'WEB', correlationId: 'client-turn-secret',
      user: { content: 'senha: segredo123456' }, assistant: { content: 'Bearer abcdefghijklmnop' },
    });
    expect(result?.turn.user.redacted).toBe(true);
    expect(result?.turn.assistant.redacted).toBe(true);
    expect(JSON.stringify(result?.turn)).not.toMatch(/segredo123456|abcdefghijklmnop/u);
  });

  it('falha transacional do turno não deixa USER, ASSISTANT nem lastMessageAt parcial', async () => {
    const conversation = await service.getOrCreateActive({ userId: 'user-a', channel: 'WEB', persona: 'NOVA' });
    const previousLastMessageAt = conversation.lastMessageAt;
    repository.failNextTurn = true;
    await expect(service.persistTurn({
      userId: 'user-a', conversationId: conversation.id, channel: 'WEB', correlationId: 'client-turn-fail',
      user: { content: 'Pergunta' }, assistant: { content: 'Resposta' },
    })).rejects.toThrow('SYNTHETIC_TURN_TRANSACTION_FAILURE');
    expect(repository.messages).toHaveLength(0);
    expect(conversation.lastMessageAt).toEqual(previousLastMessageAt);
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
    await expect(service.listConversations({ userId: 'user-a', channel: 'WEB', persona: 'NOVA' }))
      .resolves.toMatchObject({ items: [] });
    await expect(service.listMessages({ userId: 'user-a', conversationId: conversation.id, channel: 'WEB' })).resolves.toBeNull();
    await expect(service.appendMessage({ userId: 'user-a', conversationId: conversation.id, role: 'USER', content: 'depois', correlationId: 'turn-after-delete' }))
      .rejects.toThrow('NOVA_CONVERSATION_NOT_FOUND');
  });
});

function conversationShape(id: string, userId: string, persona: NovaConversation['persona']): NovaConversation {
  const now = new Date('2026-08-07T10:00:00.000Z');
  return {
    id, userId, channel: 'WEB', persona, status: 'CLOSED', startedAt: now, lastMessageAt: now,
    closedAt: now, deletedAt: null, createdAt: now, updatedAt: now,
  };
}
