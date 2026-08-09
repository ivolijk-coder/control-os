import { describe, expect, it, vi } from 'vitest';
import { NovaConversationApiClient, NovaConversationApiError, type NovaMessageDto } from '@/lib/nova-conversations/nova-conversation-api-client';
import {
  EMPTY_NOVA_CONVERSATION_CACHE,
  buildPersistTurnRequest,
  isOperationCurrent,
  markTurnUnsynced,
  mergeHydratedMessages,
  prependPersistedMessages,
  reconcilePersistedTurn,
} from '@/lib/nova-conversations/nova-conversation-workspace-model';

const persisted = (id: string, role: 'USER' | 'ASSISTANT', content = id): NovaMessageDto => ({
  id,
  role,
  content,
  intent: null,
  redacted: false,
  createdAt: '2026-08-08T12:00:00.000Z',
});

describe('workspace persistente da NOVA', () => {
  it('rehidrata um cache vazio com o histórico canônico', () => {
    expect(mergeHydratedMessages([], [persisted('1', 'USER'), persisted('2', 'ASSISTANT')]))
      .toMatchObject([{ id: '1', persistence: 'persisted' }, { id: '2', persistence: 'persisted' }]);
  });

  it('preserva apenas mensagens transitórias locais durante a hidratação', () => {
    const result = mergeHydratedMessages([
      { id: 'old', role: 'user', content: 'antiga', persistence: 'optimistic' },
      { id: 'task', role: 'nova', content: 'tarefa', persistence: 'transient' },
    ], [persisted('server', 'USER')]);
    expect(result.map(({ id }) => id)).toEqual(['server', 'task']);
  });

  it('pagina mensagens antigas sem duplicar IDs', () => {
    const current = [
      { id: '2', role: 'user' as const, content: '2', persistence: 'persisted' as const },
      { id: '3', role: 'nova' as const, content: '3', persistence: 'persisted' as const },
    ];
    expect(prependPersistedMessages(current, [persisted('1', 'USER'), persisted('2', 'USER')]).map(({ id }) => id))
      .toEqual(['1', '2', '3']);
  });

  it('substitui o par otimista pelos DTOs sanitizados do servidor', () => {
    const result = reconcilePersistedTurn([
      { id: 'local-u', role: 'user', content: 'segredo', persistence: 'optimistic', clientTurnId: 'turn-1' },
      { id: 'local-a', role: 'nova', content: 'ok', persistence: 'optimistic', clientTurnId: 'turn-1' },
    ], 'turn-1', {
      user: persisted('server-u', 'USER', '[CONTEÚDO SENSÍVEL REMOVIDO]'),
      assistant: persisted('server-a', 'ASSISTANT', 'ok'),
    });
    expect(result).toMatchObject([
      { id: 'server-u', content: '[CONTEÚDO SENSÍVEL REMOVIDO]', persistence: 'persisted' },
      { id: 'server-a', persistence: 'persisted' },
    ]);
  });

  it('preserva somente metadado visual temporário do anexo após reconciliação', () => {
    const result = reconcilePersistedTurn([
      { id: 'u', role: 'user', content: 'arquivo', persistence: 'optimistic', clientTurnId: 'turn' },
      {
        id: 'a', role: 'nova', content: 'encontrei', persistence: 'optimistic', clientTurnId: 'turn',
        attachment: { label: 'arquivo.pdf', href: '/download' },
      },
    ], 'turn', { user: persisted('su', 'USER'), assistant: persisted('sa', 'ASSISTANT') });
    expect(result[1]).toMatchObject({ id: 'sa', persistence: 'persisted', attachment: { href: '/download' } });
  });

  it('marca os dois lados como não sincronizados sem perder o clientTurnId', () => {
    const result = markTurnUnsynced([
      { id: 'u', role: 'user', content: 'u', clientTurnId: 'turn', persistence: 'optimistic' },
      { id: 'a', role: 'nova', content: 'a', clientTurnId: 'turn', persistence: 'optimistic' },
    ], 'turn');
    expect(result.every((message) => message.persistence === 'unsynced')).toBe(true);
  });

  it('descarta resposta atrasada de outra conversa ou geração', () => {
    const cache = { ...EMPTY_NOVA_CONVERSATION_CACHE, conversationId: 'conversation-2', requestGeneration: 2 };
    expect(isOperationCurrent(cache, { conversationId: 'conversation-1', requestGeneration: 2 })).toBe(false);
    expect(isOperationCurrent(cache, { conversationId: 'conversation-2', requestGeneration: 1 })).toBe(false);
    expect(isOperationCurrent(cache, { conversationId: 'conversation-2', requestGeneration: 2 })).toBe(true);
  });

  it('reutiliza o mesmo clientTurnId no payload de retry', () => {
    expect(buildPersistTurnRequest('stable-turn', 'pergunta', 'resposta')).toEqual({
      clientTurnId: 'stable-turn',
      user: { content: 'pergunta' },
      assistant: { content: 'resposta' },
    });
  });
});

describe('cliente autenticado de conversas', () => {
  it('cria/retoma a persona informada sem aceitar identidade externa', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      conversation: { id: 'c1', channel: 'WEB', persona: 'NOVA', status: 'ACTIVE' },
    }), { status: 200 }));
    const client = new NovaConversationApiClient(fetcher);
    await client.getOrCreateActive('NOVA');
    expect(fetcher).toHaveBeenCalledWith('/api/nova/conversations', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ persona: 'NOVA' }),
    }));
  });

  it('vincula paginação ao endpoint da conversa', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [], nextCursor: null, hasMore: false }), { status: 200 }));
    const client = new NovaConversationApiClient(fetcher);
    await client.listMessages('conversation/a', 'opaque cursor', 100);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/nova/conversations/conversation%2Fa/messages?limit=100&cursor=opaque+cursor');
  });

  it('persiste retry pelo endpoint atômico com o mesmo payload, sem executar IA', async () => {
    const turn = { user: persisted('u', 'USER'), assistant: persisted('a', 'ASSISTANT') };
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ success: true, turn }), { status: 200 }));
    const client = new NovaConversationApiClient(fetcher);
    const payload = buildPersistTurnRequest('same-id', 'u', 'a');
    await client.persistTurn('c1', payload);
    await client.persistTurn('c1', payload);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(fetcher.mock.calls[1]?.[1]?.body);
  });

  it('normaliza erro da API sem criar mensagem fictícia', async () => {
    const client = new NovaConversationApiClient(vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Sessão expirada.' }), { status: 401 })));
    await expect(client.getOrCreateActive('NOVA')).rejects.toEqual(expect.objectContaining<Partial<NovaConversationApiError>>({
      name: 'NovaConversationApiError',
      status: 401,
      message: 'Sessão expirada.',
    }));
  });
});
