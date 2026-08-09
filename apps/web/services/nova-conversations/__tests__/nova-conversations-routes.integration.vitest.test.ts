import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  userId: 'user-a' as string | undefined,
  listConversations: vi.fn(),
  getOrCreateActive: vi.fn(),
  listMessages: vi.fn(),
  closeConversation: vi.fn(),
  persistTurn: vi.fn(),
  processMessage: vi.fn(),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}));

vi.mock('@/services/auth/session', () => ({ currentSessionUserId: () => mocks.userId }));
vi.mock('@/services/nova-conversations', () => ({
  novaConversationService: {
    listConversations: mocks.listConversations,
    getOrCreateActive: mocks.getOrCreateActive,
    listMessages: mocks.listMessages,
    closeConversation: mocks.closeConversation,
    persistTurn: mocks.persistTurn,
  },
}));
vi.mock('@/services/nova-orchestrator', () => ({
  novaReadOnlyOrchestratorService: { process: mocks.processMessage },
}));

const conversationId = '11111111-1111-4111-8111-111111111111';
const otherConversationId = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-08-07T12:00:00.000Z');
const conversation = {
  id: conversationId,
  userId: 'user-a',
  channel: 'WEB' as const,
  persona: 'NOVA' as const,
  status: 'ACTIVE' as const,
  startedAt: now,
  lastMessageAt: now,
  closedAt: null,
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
};
const persistedTurn = {
  user: {
    id: '33333333-3333-4333-8333-333333333333', conversationId, userId: 'user-a', role: 'USER' as const,
    content: 'Pergunta', intent: null, provider: null, providerResponseId: null, correlationId: 'client-turn-001',
    sequence: '1', redacted: false, createdAt: now,
  },
  assistant: {
    id: '44444444-4444-4444-8444-444444444444', conversationId, userId: 'user-a', role: 'ASSISTANT' as const,
    content: 'Resposta', intent: null, provider: null, providerResponseId: null, correlationId: 'client-turn-001',
    sequence: '2', redacted: false, createdAt: now,
  },
};

function getRequest(path: string): NextRequest {
  return { nextUrl: new URL(`http://localhost${path}`) } as NextRequest;
}

function postRequest(path: string, body?: unknown): NextRequest {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json', 'x-user-id': 'attacker' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as NextRequest;
}

describe('APIs autenticadas de conversas da NOVA', () => {
  beforeEach(() => {
    mocks.userId = 'user-a';
    vi.clearAllMocks();
    mocks.listConversations.mockResolvedValue({ items: [conversation], nextCursor: null, hasMore: false });
    mocks.getOrCreateActive.mockResolvedValue(conversation);
    mocks.listMessages.mockResolvedValue({ messages: [], nextCursor: null, hasMore: false });
    mocks.closeConversation.mockResolvedValue({ ...conversation, status: 'CLOSED', closedAt: now });
    mocks.persistTurn.mockResolvedValue({ turn: persistedTurn, replayed: false });
    mocks.processMessage.mockResolvedValue({
      kind: 'RESULT',
      result: { status: 'COMPLETED', turnId: 'turn-id', messages: [] },
    });
  });

  it('retorna 401 em todas as quatro operações sem consultar o serviço', async () => {
    mocks.userId = undefined;
    const conversationsRoute = await import('@/app/api/nova/conversations/route');
    const messagesRoute = await import('@/app/api/nova/conversations/[id]/messages/route');
    const closeRoute = await import('@/app/api/nova/conversations/[id]/close/route');

    expect((await conversationsRoute.GET(getRequest('/api/nova/conversations?persona=NOVA'))).status).toBe(401);
    expect((await conversationsRoute.POST(postRequest('/api/nova/conversations', { persona: 'NOVA' }))).status).toBe(401);
    expect((await messagesRoute.GET(getRequest(`/api/nova/conversations/${conversationId}/messages`), { params: { id: conversationId } })).status).toBe(401);
    expect((await closeRoute.POST(postRequest(`/api/nova/conversations/${conversationId}/close`, { }), { params: { id: conversationId } })).status).toBe(401);
    expect(mocks.listConversations).not.toHaveBeenCalled();
    expect(mocks.getOrCreateActive).not.toHaveBeenCalled();
    expect(mocks.listMessages).not.toHaveBeenCalled();
    expect(mocks.closeConversation).not.toHaveBeenCalled();
  });

  it('retorna 401 ao persistir turno sem consultar o serviço', async () => {
    mocks.userId = undefined;
    const { POST } = await import('@/app/api/nova/conversations/[id]/turns/route');
    const response = await POST(postRequest(`/api/nova/conversations/${conversationId}/turns`, {
      clientTurnId: 'client-turn-001', user: { content: 'Pergunta' }, assistant: { content: 'Resposta' },
    }), { params: { id: conversationId } });
    expect(response.status).toBe(401);
    expect(mocks.persistTurn).not.toHaveBeenCalled();
  });

  it('protege o endpoint server-side de mensagens e aceita somente o contrato mínimo', async () => {
    const { POST } = await import('@/app/api/nova/conversations/[id]/messages/route');
    mocks.userId = undefined;
    expect((await POST(postRequest(`/api/nova/conversations/${conversationId}/messages`, {
      clientTurnId: 'client-read-only', content: 'Tenho conta atrasada?',
    }), { params: { id: conversationId } })).status).toBe(401);
    mocks.userId = 'user-a';
    const response = await POST(postRequest(`/api/nova/conversations/${conversationId}/messages`, {
      clientTurnId: 'client-read-only', content: 'Tenho conta atrasada?',
    }), { params: { id: conversationId } });
    expect(response.status).toBe(200);
    expect(mocks.processMessage).toHaveBeenCalledWith({
      userId: 'user-a', conversationId, clientTurnId: 'client-read-only', content: 'Tenho conta atrasada?',
    });
    expect((await POST(postRequest(`/api/nova/conversations/${conversationId}/messages`, {
      clientTurnId: 'client-read-only', content: 'A', userId: 'attacker',
    }), { params: { id: conversationId } })).status).toBe(400);
  });

  it('não faz fallback quando a flag server-side está desligada', async () => {
    mocks.processMessage.mockResolvedValueOnce({ kind: 'DISABLED' });
    const { POST } = await import('@/app/api/nova/conversations/[id]/messages/route');
    const response = await POST(postRequest(`/api/nova/conversations/${conversationId}/messages`, {
      clientTurnId: 'client-disabled', content: 'Resumo de hoje',
    }), { params: { id: conversationId } });
    expect(response.status).toBe(503);
    expect(mocks.persistTurn).not.toHaveBeenCalled();
  });

  it('persiste turno com usuário da sessão e canal WEB fixado', async () => {
    const { POST } = await import('@/app/api/nova/conversations/[id]/turns/route');
    const response = await POST(postRequest(`/api/nova/conversations/${conversationId}/turns`, {
      clientTurnId: 'client-turn-001',
      user: { content: 'Pergunta', intent: 'FINANCIAL_STATUS' },
      assistant: { content: 'Resposta' },
    }), { params: { id: conversationId } });
    expect(response.status).toBe(200);
    expect(mocks.persistTurn).toHaveBeenCalledWith({
      userId: 'user-a', conversationId, channel: 'WEB', correlationId: 'client-turn-001',
      user: { content: 'Pergunta', intent: 'FINANCIAL_STATUS' }, assistant: { content: 'Resposta' },
    });
    const json = JSON.stringify(response.body);
    for (const field of ['userId', 'conversationId', 'provider', 'providerResponseId', 'correlationId', 'sequence']) {
      expect(json).not.toContain(field);
    }
  });

  it('rejeita campos internos ou inesperados no payload do turno', async () => {
    const { POST } = await import('@/app/api/nova/conversations/[id]/turns/route');
    const invalidPayloads = [
      { clientTurnId: 'client-turn-001', userId: 'user-b', user: { content: 'A' }, assistant: { content: 'B' } },
      { clientTurnId: 'client-turn-001', channel: 'WHATSAPP', user: { content: 'A' }, assistant: { content: 'B' } },
      { clientTurnId: 'client-turn-001', user: { content: 'A', role: 'USER' }, assistant: { content: 'B' } },
      { clientTurnId: 'id com espaços', user: { content: 'A' }, assistant: { content: 'B' } },
    ];
    for (const payload of invalidPayloads) {
      const response = await POST(postRequest(`/api/nova/conversations/${conversationId}/turns`, payload), { params: { id: conversationId } });
      expect(response.status).toBe(400);
    }
    expect(mocks.persistTurn).not.toHaveBeenCalled();
  });

  it('usa o mesmo 404 para conversa estrangeira, inexistente ou apagada', async () => {
    mocks.persistTurn.mockResolvedValue(null);
    const { POST } = await import('@/app/api/nova/conversations/[id]/turns/route');
    const body = { clientTurnId: 'client-turn-404', user: { content: 'A' }, assistant: { content: 'B' } };
    const foreign = await POST(postRequest(`/api/nova/conversations/${conversationId}/turns`, body), { params: { id: conversationId } });
    const missing = await POST(postRequest(`/api/nova/conversations/${otherConversationId}/turns`, body), { params: { id: otherConversationId } });
    expect(foreign.status).toBe(404);
    expect(missing.body).toEqual(foreign.body);
  });

  it('sanitiza erro interno da persistência do turno', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.persistTurn.mockRejectedValue(new Error('Prisma postgres://secret@internal/control'));
    const { POST } = await import('@/app/api/nova/conversations/[id]/turns/route');
    const response = await POST(postRequest(`/api/nova/conversations/${conversationId}/turns`, {
      clientTurnId: 'client-turn-error', user: { content: 'A' }, assistant: { content: 'B' },
    }), { params: { id: conversationId } });
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toMatch(/Prisma|postgres|secret|internal/u);
    consoleError.mockRestore();
  });

  it('fixa WEB no servidor, isola a persona e usa limite padrão 30', async () => {
    const { GET } = await import('@/app/api/nova/conversations/route');
    const response = await GET(getRequest('/api/nova/conversations?persona=NOVA'));
    expect(response.status).toBe(200);
    expect(mocks.listConversations).toHaveBeenCalledWith({
      userId: 'user-a', channel: 'WEB', persona: 'NOVA', limit: 30, cursor: undefined,
    });
  });

  it('decodifica paginação opaca e respeita o limite máximo 100', async () => {
    const { encodeConversationCursor } = await import('../nova-conversation-api');
    const cursor = encodeConversationCursor({ id: conversationId, lastMessageAt: now });
    const { GET } = await import('@/app/api/nova/conversations/route');
    expect((await GET(getRequest(`/api/nova/conversations?persona=NOVA&limit=100&cursor=${cursor}`))).status).toBe(200);
    expect(mocks.listConversations).toHaveBeenCalledWith({
      userId: 'user-a', channel: 'WEB', persona: 'NOVA', limit: 100,
      cursor: { id: conversationId, lastMessageAt: now },
    });
    expect((await GET(getRequest('/api/nova/conversations?persona=NOVA&limit=101'))).status).toBe(400);
  });

  it('rejeita userId externo, canal externo, campos inesperados e persona inválida', async () => {
    const route = await import('@/app/api/nova/conversations/route');
    expect((await route.GET(getRequest('/api/nova/conversations?persona=NOVA&userId=user-b'))).status).toBe(400);
    expect((await route.POST(postRequest('/api/nova/conversations', { persona: 'NOVA', userId: 'user-b' }))).status).toBe(400);
    expect((await route.POST(postRequest('/api/nova/conversations', { persona: 'NOVA', channel: 'WHATSAPP' }))).status).toBe(400);
    expect((await route.POST(postRequest('/api/nova/conversations', { persona: 'INVALIDA' }))).status).toBe(400);
    expect(mocks.getOrCreateActive).not.toHaveBeenCalled();
  });

  it('separa NOVA e LEGENDARY e usa somente o usuário da sessão', async () => {
    const { POST } = await import('@/app/api/nova/conversations/route');
    await POST(postRequest('/api/nova/conversations', { persona: 'NOVA' }));
    await POST(postRequest('/api/nova/conversations', { persona: 'LEGENDARY' }));
    expect(mocks.getOrCreateActive).toHaveBeenNthCalledWith(1, { userId: 'user-a', channel: 'WEB', persona: 'NOVA' });
    expect(mocks.getOrCreateActive).toHaveBeenNthCalledWith(2, { userId: 'user-a', channel: 'WEB', persona: 'LEGENDARY' });
  });

  it('duas criações concorrentes devolvem a mesma ACTIVE sem trocar identidade', async () => {
    const { POST } = await import('@/app/api/nova/conversations/route');
    const [first, second] = await Promise.all([
      POST(postRequest('/api/nova/conversations', { persona: 'NOVA' })),
      POST(postRequest('/api/nova/conversations', { persona: 'NOVA' })),
    ]);
    expect(first.body).toEqual(second.body);
    expect(mocks.getOrCreateActive).toHaveBeenCalledTimes(2);
    expect(mocks.getOrCreateActive).toHaveBeenCalledWith({ userId: 'user-a', channel: 'WEB', persona: 'NOVA' });
  });

  it('usa o mesmo 404 para conversa estrangeira ou inexistente', async () => {
    mocks.listMessages.mockResolvedValue(null);
    const { GET } = await import('@/app/api/nova/conversations/[id]/messages/route');
    const foreign = await GET(getRequest(`/api/nova/conversations/${conversationId}/messages`), { params: { id: conversationId } });
    const missing = await GET(getRequest(`/api/nova/conversations/${otherConversationId}/messages`), { params: { id: otherConversationId } });
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
  });

  it('recusa cursor de mensagens reaproveitado em outra conversa', async () => {
    const { encodeMessageCursor } = await import('../nova-conversation-api');
    const cursor = encodeMessageCursor(conversationId, '9');
    const { GET } = await import('@/app/api/nova/conversations/[id]/messages/route');
    const response = await GET(getRequest(`/api/nova/conversations/${otherConversationId}/messages?cursor=${cursor}`), {
      params: { id: otherConversationId },
    });
    expect(response.status).toBe(400);
    expect(mocks.listMessages).not.toHaveBeenCalled();
  });

  it('não expõe campos internos de conversa ou mensagem', async () => {
    const message = {
      id: '33333333-3333-4333-8333-333333333333', conversationId, userId: 'user-a', role: 'USER' as const,
      content: 'Olá', intent: null, provider: 'secret', providerResponseId: 'response-secret',
      correlationId: 'correlation-secret', sequence: '9', redacted: false, createdAt: now,
    };
    mocks.listMessages.mockResolvedValue({ messages: [message], nextCursor: null, hasMore: false });
    const conversationsRoute = await import('@/app/api/nova/conversations/route');
    const messagesRoute = await import('@/app/api/nova/conversations/[id]/messages/route');
    const conversationResponse = await conversationsRoute.GET(getRequest('/api/nova/conversations?persona=NOVA'));
    const messageResponse = await messagesRoute.GET(getRequest(`/api/nova/conversations/${conversationId}/messages`), { params: { id: conversationId } });
    const json = JSON.stringify([conversationResponse.body, messageResponse.body]);
    for (const field of ['userId', 'deletedAt', 'activeKey', 'providerResponseId', 'correlationId', 'sequence']) {
      expect(json).not.toContain(field);
    }
  });

  it('fecha exatamente o ID solicitado, rejeita body e preserva idempotência', async () => {
    const { POST } = await import('@/app/api/nova/conversations/[id]/close/route');
    const first = await POST(postRequest(`/api/nova/conversations/${conversationId}/close`, { }), { params: { id: conversationId } });
    const second = await POST(postRequest(`/api/nova/conversations/${conversationId}/close`, { }), { params: { id: conversationId } });
    expect(first.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(mocks.closeConversation).toHaveBeenCalledTimes(2);
    expect(mocks.closeConversation).toHaveBeenCalledWith({ userId: 'user-a', conversationId, channel: 'WEB' });
    expect((await POST(postRequest(`/api/nova/conversations/${conversationId}/close`, { userId: 'user-b' }), { params: { id: conversationId } })).status).toBe(400);
  });

  it('não expõe mensagem de Prisma/conexão em erro interno', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.listConversations.mockRejectedValue(new Error('Prisma postgres://secret@internal/control'));
    const { GET } = await import('@/app/api/nova/conversations/route');
    const response = await GET(getRequest('/api/nova/conversations?persona=NOVA'));
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toMatch(/Prisma|postgres|secret|internal/u);
    consoleError.mockRestore();
  });
});
