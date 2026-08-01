import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { auditDocument } from '@/services/documents/document-core';
import { dismissConversationTask } from '@/services/conversation-tasks';

/**
 * `POST /api/nova/conversation-tasks/:id/dismiss` — botão "Depois", sempre
 * disponível em qualquer bolha de `ConversationTask` (Fase D —
 * `nova-message-bubble.tsx`). Genérico por natureza: nunca executa nada
 * específico de um `type` de task, só marca `DISMISSED` — a mesma
 * transição atômica (`PENDING`/`WAITING_USER` -> `DISMISSED`) que protege
 * contra clique duplo ou reenvio da mesma mensagem.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ success: false, message: 'Faça login para continuar a conversa.' }, { status: 401 });

  const dismissed = await dismissConversationTask({ id: params.id, userId });
  if (!dismissed) {
    return NextResponse.json({ success: false, message: 'Essa conversa já não está mais disponível.' }, { status: 409 });
  }

  await auditDocument({
    userId,
    operation: 'CONVERSATION_TASK_DISMISSED',
    source: 'nova',
    entityType: 'conversation_task',
    entityId: params.id,
    correlationId: params.id,
  });

  return NextResponse.json({ success: true, reply: 'Tudo bem, deixo pra depois. Você pode voltar a isso quando quiser.' });
}
