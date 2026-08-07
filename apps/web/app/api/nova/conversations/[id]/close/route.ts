import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import {
  assertEmptyRequestBody,
  isConversationId,
  NovaConversationRequestError,
  toPublicConversation,
} from '@/services/nova-conversations/nova-conversation-api';
import { novaConversationService } from '@/services/nova-conversations';

function failure(message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request: NextRequest, context: { params: { id: string } }): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return failure('Faça login para encerrar uma conversa.', 401);
  const conversationId = context.params.id;
  if (!isConversationId(conversationId)) return failure('Conversa não encontrada.', 404);

  try {
    await assertEmptyRequestBody(request);
    const conversation = await novaConversationService.closeConversation({ userId, conversationId, channel: 'WEB' });
    if (!conversation) return failure('Conversa não encontrada.', 404);
    return NextResponse.json({ success: true, conversation: toPublicConversation(conversation) });
  } catch (cause) {
    if (cause instanceof NovaConversationRequestError) return failure(cause.message, 400);
    console.error('Falha ao encerrar conversa da NOVA:', cause instanceof Error ? cause.name : 'UnknownError');
    return failure('Não foi possível encerrar a conversa agora.', 500);
  }
}
