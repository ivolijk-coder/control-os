import { prisma } from '@/lib/prisma';
import { PersistentFinanceService } from '@/services/modules';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';
import { PrismaFinanceRepository } from '@/services/repositories';
import { randomUUID } from 'node:crypto';

/**
 * `DocumentProposalConfirmationService` — fonte única de verdade para
 * confirmar um `DocumentImportProposal` e criar o parcelamento financeiro
 * correspondente.
 *
 * Extraído de `app/api/documents/proposals/[id]/confirm/route.ts`
 * (evolução "NOVA como centro da experiência") para que a tela de
 * Documentos e a futura Action conversacional da NOVA cheguem ao MESMO
 * resultado, pela MESMA validação, na MESMA transação `Serializable` —
 * "Nunca duplicar regras". A rota HTTP e a Action da NOVA (Fase E) são os
 * dois únicos chamadores previstos; nenhum dos dois deve reimplementar
 * nada disto.
 *
 * Comportamento idêntico ao código anterior, apenas movido de lugar: a
 * reserva atômica do status (`PENDING`/`READY_FOR_REVIEW` -> `PROCESSING`),
 * a validação dos campos financeiros flat, a baixa via
 * `PersistentFinanceService.createInstallment`, a confirmação final e o
 * evento de auditoria continuam no mesmo commit de transação de antes.
 */
export class ConfirmationError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export type ConfirmDocumentProposalInput = {
  proposalId: string;
  userId: string;
  accountId: string;
  categoryId: string;
  startDate?: string;
};

export type ConfirmDocumentProposalResult = {
  alreadyConfirmed: boolean;
  installmentGroupId: string | null;
  message: string;
};

export async function confirmDocumentProposal(
  input: ConfirmDocumentProposalInput
): Promise<ConfirmDocumentProposalResult> {
  const { proposalId, userId, accountId, categoryId, startDate } = input;

  return prisma.$transaction(async (tx) => {
    const proposal = await tx.documentImportProposal.findFirst({ where: { id: proposalId, userId }, include: { document: true } });
    if (!proposal) throw new ConfirmationError(404, 'Proposta não encontrada.');
    if (proposal.status === 'CONFIRMED') {
      return { alreadyConfirmed: true, installmentGroupId: proposal.resultingInstallmentGroupId, message: 'Esta prévia já havia sido confirmada.' };
    }

    // A reserva, a baixa financeira, a confirmação e a auditoria pertencem
    // ao mesmo commit. Se qualquer etapa falhar, o status volta a PENDING.
    const reserved = await tx.documentImportProposal.updateMany({ where: { id: proposal.id, userId, status: { in: ['PENDING', 'READY_FOR_REVIEW'] } }, data: { status: 'PROCESSING' } });
    if (!reserved.count) throw new ConfirmationError(409, 'Esta prévia já está sendo confirmada ou não pode mais ser confirmada.');

    const data = proposal.extractedData as { totalAmount?: number; installments?: number; creditorName?: string | null; summary?: string | null; firstDueDate?: string | null };
    if (!(Number(data.totalAmount) > 0) || !(Number(data.installments) >= 2)) {
      throw new ConfirmationError(422, 'O contrato não trouxe valor e parcelas suficientes para criar um parcelamento.');
    }

    const service = new PersistentFinanceService(new PrismaFinanceRepository(tx), userId);
    const result = await runAsFinanceUser(userId, () => service.createInstallment({
      type: 'despesa', totalAmount: Number(data.totalAmount), installments: Number(data.installments),
      description: data.summary || data.creditorName || proposal.document.title,
      categoryId, accountId,
      startDate: startDate || data.firstDueDate || new Date().toISOString(),
      idempotencyKey: `document-proposal:${proposal.id}`,
    }));
    if (!result.success) throw new ConfirmationError(422, result.message);
    const entries = Array.isArray(result.data) ? result.data as Array<{ installmentGroupId?: string }> : [];
    const groupId = entries[0]?.installmentGroupId ?? null;
    const correlationId = randomUUID();
    await tx.documentImportProposal.update({ where: { id: proposal.id }, data: { status: 'CONFIRMED', confirmedAt: new Date(), resultingInstallmentGroupId: groupId } });
    await tx.documentAuditEvent.create({ data: { userId, documentId: proposal.documentId, proposalId: proposal.id, operation: 'PREVIEW_CONFIRMED', source: 'nova', entityType: 'document_preview', entityId: proposal.id, correlationId, after: { installmentGroupId: groupId, idempotencyKey: `document-proposal:${proposal.id}` } } });
    return { alreadyConfirmed: false, installmentGroupId: groupId, message: result.message };
  }, { isolationLevel: 'Serializable' });
}
