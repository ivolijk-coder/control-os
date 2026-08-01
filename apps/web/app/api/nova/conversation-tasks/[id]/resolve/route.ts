import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { auditDocument } from '@/services/documents/document-core';
import { claimConversationTaskForResolution, completeConversationTask, revertConversationTaskToWaitingUser } from '@/services/conversation-tasks';

/**
 * `POST /api/nova/conversation-tasks/:id/resolve` — usuário escolheu uma
 * das `actions` de uma `ConversationTask` (Fase D — "NOVA como centro da
 * experiência").
 *
 * Idempotência (clique duplo, refresh, mensagem repetida): `claim` só
 * avança quando a task ainda está `PENDING`/`WAITING_USER` — o mesmo
 * "claim atômico" via `updateMany` que `DocumentProposalConfirmationService`
 * já usa. Uma segunda chamada concorrente recebe 409 e não executa nada de
 * novo.
 *
 * Ponto de extensão da Fase E: hoje NENHUM handler por `(type, actionId)`
 * existe ainda — esta rota só reconhece a escolha do usuário (audita
 * `CONVERSATION_TASK_USER_CONFIRMED`) e conclui a task genericamente,
 * nunca executando nada financeiro. A Fase E insere aqui um "handler
 * registry" (`Record<ConversationTaskType, ...>`) que intercepta ações
 * como `"cadastrar_financiamento"` ANTES da conclusão genérica e chama
 * `DocumentProposalConfirmationService` de verdade — "IA sugere ->
 * ConversationTask -> usuário confirma -> Action validada -> Service
 * executa": nenhuma `ConversationTask` decide dinheiro sozinha, nem antes
 * nem depois da Fase E.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ success: false, message: 'Faça login para continuar a conversa.' }, { status: 401 });

  const body = await request.json().catch(() => null) as { actionId?: string } | null;
  if (!body?.actionId) return NextResponse.json({ success: false, message: 'Escolha uma ação antes de continuar.' }, { status: 400 });

  const claimed = await claimConversationTaskForResolution({ id: params.id, userId });
  if (!claimed) {
    return NextResponse.json({ success: false, message: 'Essa conversa já foi resolvida ou não está mais disponível.' }, { status: 409 });
  }

  await auditDocument({
    userId,
    operation: 'CONVERSATION_TASK_USER_CONFIRMED',
    source: 'nova',
    entityType: 'conversation_task',
    entityId: claimed.id,
    correlationId: claimed.id,
    after: { actionId: body.actionId },
  });

  try {
    // Fase D: sem handler específico ainda, então toda ação só reconhece a
    // escolha do usuário — nunca cria nem altera nada financeiro. A Fase E
    // substitui este bloco por um dispatch real por `claimed.type`.
    await completeConversationTask({ id: claimed.id, userId });
    return NextResponse.json({ success: true, reply: 'Entendido! Já registrei sua escolha.' });
  } catch (error) {
    await revertConversationTaskToWaitingUser({ id: claimed.id, userId }).catch(() => undefined);
    throw error;
  }
}
