import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import {
  assertOnlyQueryParameters,
  encodeConversationCursor,
  NovaConversationRequestError,
  parseConversationCursor,
  parseCreateConversationBody,
  parsePageLimit,
  parsePersona,
  toPublicConversation,
} from '@/services/nova-conversations/nova-conversation-api';
import { novaConversationService } from '@/services/nova-conversations';

function failure(message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, message }, { status });
}

function internalFailure(label: string, cause: unknown): NextResponse {
  console.error(label, cause instanceof Error ? cause.name : 'UnknownError');
  return failure('Não foi possível acessar suas conversas agora.', 500);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return failure('Faça login para consultar suas conversas.', 401);

  try {
    const search = request.nextUrl.searchParams;
    assertOnlyQueryParameters(search, ['persona', 'cursor', 'limit']);
    const persona = parsePersona(search.get('persona'));
    const limit = parsePageLimit(search.get('limit'));
    const cursor = parseConversationCursor(search.get('cursor'));
    const page = await novaConversationService.listConversations({ userId, channel: 'WEB', persona, limit, cursor });
    return NextResponse.json({
      success: true,
      items: page.items.map(toPublicConversation),
      nextCursor: page.nextCursor ? encodeConversationCursor(page.nextCursor) : null,
      hasMore: page.hasMore,
    });
  } catch (cause) {
    if (cause instanceof NovaConversationRequestError) return failure(cause.message, 400);
    return internalFailure('Falha ao listar conversas da NOVA:', cause);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return failure('Faça login para iniciar uma conversa.', 401);

  try {
    const { persona } = await parseCreateConversationBody(request);
    const conversation = await novaConversationService.getOrCreateActive({ userId, channel: 'WEB', persona });
    return NextResponse.json({ success: true, conversation: toPublicConversation(conversation) });
  } catch (cause) {
    if (cause instanceof NovaConversationRequestError) return failure(cause.message, 400);
    return internalFailure('Falha ao iniciar conversa da NOVA:', cause);
  }
}
