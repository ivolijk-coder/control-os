import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentSessionUserId } from '@/services/auth/session';
import { PersistentFinanceService } from '@/services/modules';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';
import { PrismaFinanceRepository } from '@/services/repositories';
import { randomUUID } from 'node:crypto';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const userId = await currentSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const body = await request.json().catch(() => null) as { accountId?: string; categoryId?: string; startDate?: string } | null;
  if (!body?.accountId || !body.categoryId) {
    return NextResponse.json({ error: 'Escolha a conta bancária e a categoria antes de confirmar.' }, { status: 400 });
  }
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const proposal = await tx.documentImportProposal.findFirst({ where: { id: params.id, userId }, include: { document: true } });
      if (!proposal) throw new ConfirmationError(404, 'Proposta não encontrada.');
      if (proposal.status === 'CONFIRMED') return { alreadyConfirmed: true, installmentGroupId: proposal.resultingInstallmentGroupId, message: 'Esta prévia já havia sido confirmada.' };

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
        categoryId: body.categoryId, accountId: body.accountId,
        startDate: body.startDate || data.firstDueDate || new Date().toISOString(),
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
    return NextResponse.json({ ok: true, ...outcome });
  } catch (error) {
    if (error instanceof ConfirmationError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

class ConfirmationError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
