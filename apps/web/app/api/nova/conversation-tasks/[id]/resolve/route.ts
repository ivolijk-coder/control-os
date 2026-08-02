import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { auditDocument } from '@/services/documents/document-core';
import { ConfirmationError } from '@/services/documents/document-proposal-confirmation.service';
import { resolveDocumentConversationTaskAction } from '@/services/documents/conversation-task-handler';
import { claimConversationTaskForResolution, completeConversationTask, revertConversationTaskToWaitingUser } from '@/services/conversation-tasks';

/**
 * `POST /api/nova/conversation-tasks/:id/resolve` — usuário escolheu uma
 * das `actions` de uma `ConversationTask` (Fase D, com handler real desde
 * a Fase E — "NOVA como centro da experiência").
 *
 * Idempotência (clique duplo, refresh, mensagem repetida): `claim` só
 * avança quando a task ainda está `PENDING`/`WAITING_USER` — o mesmo
 * "claim atômico" via `updateMany` que `DocumentProposalConfirmationService`
 * já usa. Uma segunda chamada concorrente recebe 409 e não executa nada de
 * novo; a MESMA garantia cobre "cadastrar_financiamento", porque a rota
 * nunca chama o service financeiro sem antes ter ganhado o claim.
 *
 * `accountId`/`categoryId`/`startDate` são opcionais no corpo — só
 * "cadastrar_financiamento" os exige (a NOVA já coletou os dois em chat,
 * com opções reais, antes de chamar esta rota — ver `nova-workspace.tsx`,
 * Fase E). Handler registry por `sourceType`: hoje só documentos
 * (`resolveDocumentConversationTaskAction`); um produtor futuro (email,
 * PIX...) ganha o seu próprio handler, verificado na mesma ordem, sem
 * mexer neste arquivo além de acrescentar a chamada.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ success: false, message: 'Faça login para continuar a conversa.' }, { status: 401 });

  const body = await request.json().catch(() => null) as { actionId?: string; accountId?: string; categoryId?: string; startDate?: string } | null;
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
    // Handler registry por sourceType — hoje só documentos. `null` (task
    // sem handler específico ou actionId não reconhecido) cai na conclusão
    // genérica, igual ao comportamento da Fase D: nunca executa nada
    // financeiro sozinha.
    const resolution = await resolveDocumentConversationTaskAction(claimed, body.actionId, userId, {
      accountId: body.accountId,
      categoryId: body.categoryId,
      startDate: body.startDate,
    });

    await completeConversationTask({ id: claimed.id, userId });

    if (resolution?.financial) {
      // correlationId = id da task: liga esta confirmação à mesma cadeia
      // de auditoria criada em CONVERSATION_TASK_CREATED (Fase C).
      await auditDocument({
        userId,
        proposalId: typeof claimed.payload.proposalId === 'string' ? claimed.payload.proposalId : undefined,
        operation: 'DOCUMENT_PROPOSAL_CONFIRMED',
        source: 'nova',
        entityType: 'document_preview',
        entityId: typeof claimed.payload.proposalId === 'string' ? claimed.payload.proposalId : claimed.id,
        correlationId: claimed.id,
        after: { installmentGroupId: resolution.installmentGroupId ?? null },
      });
      // `alreadyConfirmed` (Fase E): a proposta já estava CONFIRMED antes
      // desta chamada (idempotência do próprio
      // `DocumentProposalConfirmationService`, ver Fase A) — nada foi
      // criado agora, então não auditamos uma criação que não aconteceu.
      if (resolution.installmentGroupId && !resolution.alreadyConfirmed) {
        await auditDocument({
          userId,
          operation: 'FINANCIAL_ENTITY_CREATED',
          source: 'nova',
          entityType: 'installment_group',
          entityId: resolution.installmentGroupId,
          correlationId: claimed.id,
        });
      }
    }

    return NextResponse.json({ success: true, reply: resolution?.reply ?? 'Entendido! Já registrei sua escolha.' });
  } catch (error) {
    await revertConversationTaskToWaitingUser({ id: claimed.id, userId }).catch(() => undefined);
    if (error instanceof ConfirmationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    throw error;
  }
}
