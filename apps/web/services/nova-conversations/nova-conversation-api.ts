import 'server-only';

import type {
  ConversationCursor,
  NovaConversation,
  NovaConversationPersona,
  NovaMessage,
} from './nova-conversation.types';

export const DEFAULT_CONVERSATION_PAGE_LIMIT = 30;
export const MAX_CONVERSATION_PAGE_LIMIT = 100;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SEQUENCE_PATTERN = /^[1-9][0-9]*$/u;
const MAX_CURSOR_LENGTH = 512;

export class NovaConversationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NovaConversationRequestError';
  }
}

export type PublicNovaConversationDTO = {
  id: string;
  channel: NovaConversation['channel'];
  persona: NovaConversation['persona'];
  status: NovaConversation['status'];
  startedAt: string;
  lastMessageAt: string;
  closedAt: string | null;
  createdAt: string;
};

export type PublicNovaMessageDTO = {
  id: string;
  role: NovaMessage['role'];
  content: string;
  intent: string | null;
  redacted: boolean;
  createdAt: string;
};

type ConversationCursorPayload = {
  v: 1;
  lastMessageAt: string;
  id: string;
};

type MessageCursorPayload = {
  v: 1;
  conversationId: string;
  beforeSequence: string;
};

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function parseBase64Json(value: string): unknown {
  if (!value || value.length > MAX_CURSOR_LENGTH || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new NovaConversationRequestError('Cursor inválido.');
  }
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
  } catch {
    throw new NovaConversationRequestError('Cursor inválido.');
  }
}

function encodeCursor(value: ConversationCursorPayload | MessageCursorPayload): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function isConversationId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function parsePersona(value: unknown): NovaConversationPersona {
  if (value !== 'NOVA' && value !== 'LEGENDARY') {
    throw new NovaConversationRequestError('Persona inválida.');
  }
  return value;
}

export function parsePageLimit(value: string | null): number {
  if (value === null) return DEFAULT_CONVERSATION_PAGE_LIMIT;
  if (!/^[1-9][0-9]*$/u.test(value)) throw new NovaConversationRequestError('Limite inválido.');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > MAX_CONVERSATION_PAGE_LIMIT) {
    throw new NovaConversationRequestError(`O limite deve estar entre 1 e ${MAX_CONVERSATION_PAGE_LIMIT}.`);
  }
  return parsed;
}

export function assertOnlyQueryParameters(search: URLSearchParams, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  for (const key of search.keys()) {
    if (!allowedSet.has(key)) throw new NovaConversationRequestError(`Parâmetro não permitido: ${key}.`);
  }
  for (const key of allowed) {
    if (search.getAll(key).length > 1) throw new NovaConversationRequestError(`Parâmetro repetido: ${key}.`);
  }
}

export function encodeConversationCursor(cursor: ConversationCursor): string {
  return encodeCursor({ v: 1, lastMessageAt: cursor.lastMessageAt.toISOString(), id: cursor.id });
}

export function parseConversationCursor(value: string | null): ConversationCursor | undefined {
  if (value === null) return undefined;
  const payload = record(parseBase64Json(value));
  if (
    !payload || Object.keys(payload).length !== 3 ||
    payload?.v !== 1 ||
    typeof payload.lastMessageAt !== 'string' ||
    Number.isNaN(new Date(payload.lastMessageAt).getTime()) ||
    typeof payload.id !== 'string' ||
    !isConversationId(payload.id)
  ) {
    throw new NovaConversationRequestError('Cursor inválido.');
  }
  return { lastMessageAt: new Date(payload.lastMessageAt), id: payload.id };
}

export function encodeMessageCursor(conversationId: string, beforeSequence: string): string {
  return encodeCursor({ v: 1, conversationId, beforeSequence });
}

export function parseMessageCursor(value: string | null, conversationId: string): string | undefined {
  if (value === null) return undefined;
  const payload = record(parseBase64Json(value));
  if (
    !payload || Object.keys(payload).length !== 3 ||
    payload?.v !== 1 ||
    payload.conversationId !== conversationId ||
    typeof payload.beforeSequence !== 'string' ||
    !SEQUENCE_PATTERN.test(payload.beforeSequence)
  ) {
    throw new NovaConversationRequestError('Cursor inválido.');
  }
  return payload.beforeSequence;
}

export async function parseCreateConversationBody(request: Request): Promise<{ persona: NovaConversationPersona }> {
  const body = record(await request.json().catch(() => undefined));
  if (!body || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'persona')) {
    throw new NovaConversationRequestError('Informe somente a persona da conversa.');
  }
  return { persona: parsePersona(body.persona) };
}

export async function assertEmptyRequestBody(request: Request): Promise<void> {
  const raw = await request.text();
  if (!raw.trim()) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new NovaConversationRequestError('Corpo inválido.');
  }
  const body = record(parsed);
  if (!body || Object.keys(body).length > 0) {
    throw new NovaConversationRequestError('Esta operação não aceita campos no corpo.');
  }
}

export function toPublicConversation(conversation: NovaConversation): PublicNovaConversationDTO {
  return {
    id: conversation.id,
    channel: conversation.channel,
    persona: conversation.persona,
    status: conversation.status,
    startedAt: conversation.startedAt.toISOString(),
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    closedAt: conversation.closedAt?.toISOString() ?? null,
    createdAt: conversation.createdAt.toISOString(),
  };
}

export function toPublicMessage(message: NovaMessage): PublicNovaMessageDTO {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    intent: message.intent,
    redacted: message.redacted,
    createdAt: message.createdAt.toISOString(),
  };
}
