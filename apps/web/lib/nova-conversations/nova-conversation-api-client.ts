'use client';

export type NovaConversationPersonaDto = 'NOVA' | 'LEGENDARY';
export type NovaConversationStatusDto = 'ACTIVE' | 'CLOSED' | 'ARCHIVED';

export type NovaConversationDto = {
  id: string;
  channel: 'WEB';
  persona: NovaConversationPersonaDto;
  status: NovaConversationStatusDto;
  startedAt: string;
  lastMessageAt: string;
  closedAt: string | null;
  createdAt: string;
};

export type NovaMessageDto = {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  intent: string | null;
  redacted: boolean;
  createdAt: string;
};

export type NovaConversationTurnDto = {
  user: NovaMessageDto;
  assistant: NovaMessageDto;
};

export type NovaMessagePageDto = {
  items: NovaMessageDto[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type PersistTurnRequest = {
  clientTurnId: string;
  user: { content: string; intent?: string };
  assistant: { content: string; intent?: string };
};

export type ProcessNovaMessageRequest = {
  clientTurnId: string;
  content: string;
};

export type NovaOrchestratorResultDto =
  | { status: 'COMPLETED'; turnId: string; messages: NovaMessageDto[] }
  | { status: 'PROCESSING'; turnId: string }
  | { status: 'FAILED'; turnId: string; error: { code: string; message: string } };

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const defaultFetcher: Fetcher = (input, init) => fetch(input, init);

export class NovaConversationApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = 'NovaConversationApiError';
  }
}

export class NovaConversationApiClient {
  constructor(private readonly fetcher: Fetcher = defaultFetcher) {}

  async getOrCreateActive(persona: NovaConversationPersonaDto, signal?: AbortSignal): Promise<NovaConversationDto> {
    const payload = await this.request<{ success: true; conversation: NovaConversationDto }>(
      '/api/nova/conversations',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona }),
        signal,
      }
    );
    return payload.conversation;
  }

  async listMessages(conversationId: string, cursor?: string, limit = 30, signal?: AbortSignal): Promise<NovaMessagePageDto> {
    const query = new URLSearchParams({ limit: String(limit) });
    if (cursor) query.set('cursor', cursor);
    return this.request<NovaMessagePageDto & { success: true }>(
      `/api/nova/conversations/${encodeURIComponent(conversationId)}/messages?${query.toString()}`,
      { signal }
    );
  }

  async persistTurn(conversationId: string, input: PersistTurnRequest, signal?: AbortSignal): Promise<NovaConversationTurnDto> {
    const payload = await this.request<{ success: true; turn: NovaConversationTurnDto }>(
      `/api/nova/conversations/${encodeURIComponent(conversationId)}/turns`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal,
      }
    );
    return payload.turn;
  }

  async processMessage(
    conversationId: string,
    input: ProcessNovaMessageRequest,
    signal?: AbortSignal
  ): Promise<NovaOrchestratorResultDto> {
    let response: Response;
    try {
      response = await this.fetcher(
        `/api/nova/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal,
        }
      );
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
      throw new NovaConversationApiError('Não foi possível conectar ao Orchestrator da NOVA.', 0);
    }
    const payload = await response.json().catch(() => null) as {
      message?: string;
      code?: string;
      result?: NovaOrchestratorResultDto;
    } | null;
    // FAILED é uma conclusão conhecida do pipeline, não uma falha de
    // transporte e jamais pode autorizar fallback para o legado.
    if (payload?.result) return payload.result;
    throw new NovaConversationApiError(
      payload?.message ?? 'Não foi possível processar esta mensagem agora.',
      response.status,
      payload?.code
    );
  }

  async closeConversation(conversationId: string, signal?: AbortSignal): Promise<NovaConversationDto> {
    const payload = await this.request<{ success: true; conversation: NovaConversationDto }>(
      `/api/nova/conversations/${encodeURIComponent(conversationId)}/close`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal }
    );
    return payload.conversation;
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher(url, init);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
      throw new NovaConversationApiError('Não foi possível conectar ao histórico da NOVA.', 0);
    }

    const payload = await response.json().catch(() => null) as (T & { message?: string; code?: string }) | null;
    if (!response.ok || !payload) {
      throw new NovaConversationApiError(
        payload?.message ?? 'Não foi possível acessar o histórico da NOVA.',
        response.status,
        payload?.code
      );
    }
    return payload;
  }
}

export const novaConversationApiClient = new NovaConversationApiClient();
