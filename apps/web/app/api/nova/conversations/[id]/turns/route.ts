import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import {
  isConversationId,
  NovaConversationRequestError,
  parsePersistTurnBody,
  toPublicTurn,
} from '@/services/nova-conversations/nova-conversation-api';
import { novaConversationService } from '@/services/nova-conversations';

function failure(message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request: NextRequest, context: { params: { id: string } }): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return failure('Faça login para salvar esta conversa.', 401);
  const conversationId = context.params.id;
  if (!isConversationId(conversationId)) return failure('Conversa não encontrada.', 404);

  try {
    const input = await parsePersistTurnBody(request);
    const result = await novaConversationService.persistTurn({
      userId,
      conversationId,
      channel: 'WEB',
      correlationId: input.clientTurnId,
      user: input.user,
      assistant: input.assistant,
    });
    if (!result) return failure('Conversa não encontrada.', 404);
    return NextResponse.json({ success: true, turn: toPublicTurn(result.turn) });
  } catch (cause) {
    if (cause instanceof NovaConversationRequestError) return failure(cause.message, 400);
    console.error('Falha ao persistir turno da NOVA:', cause instanceof Error ? cause.name : 'UnknownError');
    return failure('Não foi possível salvar esta conversa agora.', 500);
  }
}
