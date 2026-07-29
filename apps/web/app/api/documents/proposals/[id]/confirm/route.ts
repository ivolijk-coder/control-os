import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentSessionUserId } from '@/services/auth/session';
import { financeService } from '@/services/modules';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const userId = await currentSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const proposal = await prisma.documentImportProposal.findFirst({
    where: { id: params.id, userId },
    include: { document: true },
  });
  if (!proposal) return NextResponse.json({ error: 'Proposta não encontrada.' }, { status: 404 });
  if (proposal.status === 'CONFIRMED') return NextResponse.json({ ok: true, alreadyConfirmed: true, installmentGroupId: proposal.resultingInstallmentGroupId });
  if (proposal.status !== 'PENDING') return NextResponse.json({ error: 'Esta proposta não pode mais ser confirmada.' }, { status: 409 });

  const body = await request.json().catch(() => null) as { accountId?: string; categoryId?: string; startDate?: string } | null;
  if (!body?.accountId || !body.categoryId) {
    return NextResponse.json({ error: 'Escolha a conta bancária e a categoria antes de confirmar.' }, { status: 400 });
  }
  const data = proposal.extractedData as { totalAmount?: number; installments?: number; creditorName?: string | null; summary?: string | null; firstDueDate?: string | null };
  if (!(Number(data.totalAmount) > 0) || !(Number(data.installments) >= 2)) {
    return NextResponse.json({ error: 'O contrato não trouxe valor e parcelas suficientes para criar um parcelamento.' }, { status: 422 });
  }

  const result = await runAsFinanceUser(userId, () => financeService.createInstallment({
    type: 'despesa', totalAmount: Number(data.totalAmount), installments: Number(data.installments),
    description: data.summary || data.creditorName || proposal.document.title,
    categoryId: body.categoryId, accountId: body.accountId,
    startDate: body.startDate || data.firstDueDate || new Date().toISOString(),
    idempotencyKey: `document-proposal:${proposal.id}`,
  }));
  if (!result.success) return NextResponse.json({ error: result.message }, { status: 422 });
  const entries = Array.isArray(result.data) ? result.data as Array<{ installmentGroupId?: string }> : [];
  const groupId = entries[0]?.installmentGroupId ?? null;
  await prisma.documentImportProposal.update({
    where: { id: proposal.id },
    data: { status: 'CONFIRMED', confirmedAt: new Date(), resultingInstallmentGroupId: groupId },
  });
  return NextResponse.json({ ok: true, message: result.message, installmentGroupId: groupId });
}
