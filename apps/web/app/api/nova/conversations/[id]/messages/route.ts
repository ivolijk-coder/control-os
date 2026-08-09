import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import {
  assertOnlyQueryParameters,
  encodeMessageCursor,
  isConversationId,
  NovaConversationRequestError,
  parseMessageCursor,
  parseProcessMessageBody,
  parsePageLimit,
  toPublicMessage,
} from '@/services/nova-conversations/nova-conversation-api';
import { novaConversationService } from '@/services/nova-conversations';
import { novaReadOnlyOrchestratorService } from '@/services/nova-orchestrator';

function failure(message: string, status: number, code?: string): NextResponse {
  return NextResponse.json({ success: false, message, ...(code ? { code } : {}) }, { status });
}

export async function GET(request: NextRequest, context: { params: { id: string } }): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return failure('Faça login para consultar as mensagens.', 401);
  const conversationId = context.params.id;
  if (!isConversationId(conversationId)) return failure('Conversa não encontrada.', 404);

  try {
    const search = request.nextUrl.searchParams;
    assertOnlyQueryParameters(search, ['cursor', 'limit']);
    const limit = parsePageLimit(search.get('limit'));
    const cursor = parseMessageCursor(search.get('cursor'), conversationId);
    const page = await novaConversationService.listMessages({
      userId,
      conversationId,
      channel: 'WEB',
      limit,
      cursor,
    });
    if (!page) return failure('Conversa não encontrada.', 404);
    return NextResponse.json({
      success: true,
      items: page.messages.map(toPublicMessage),
      nextCursor: page.nextCursor ? encodeMessageCursor(conversationId, page.nextCursor) : null,
      hasMore: page.hasMore,
    });
  } catch (cause) {
    if (cause instanceof NovaConversationRequestError) return failure(cause.message, 400);
    console.error('Falha ao listar mensagens da NOVA:', cause instanceof Error ? cause.name : 'UnknownError');
    return failure('Não foi possível acessar as mensagens agora.', 500);
  }
}

export async function POST(request: NextRequest, context: { params: { id: string } }): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return failure('Faça login para conversar com a NOVA.', 401);
  const conversationId = context.params.id;
  if (!isConversationId(conversationId)) return failure('Conversa não encontrada.', 404);

  try {
    const input = await parseProcessMessageBody(request);
    const outcome = await novaReadOnlyOrchestratorService.process({ userId, conversationId, ...input });
    if (outcome.kind === 'NOT_FOUND') return failure('Conversa não encontrada.', 404);
    if (outcome.kind === 'DISABLED') {
      return failure('O processamento server-side da NOVA ainda não está disponível.', 503, 'ORCHESTRATOR_DISABLED');
    }
    const status = outcome.result.status === 'PROCESSING' ? 202 : outcome.result.status === 'FAILED' ? 409 : 200;
    return NextResponse.json({ success: outcome.result.status !== 'FAILED', result: outcome.result }, { status });
  } catch (cause) {
    if (cause instanceof NovaConversationRequestError) return failure(cause.message, 400);
    console.error('Falha no orchestrator read-only da NOVA:', cause instanceof Error ? cause.name : 'UnknownError');
    return failure('Não foi possível processar esta mensagem agora.', 500);
  }
}
