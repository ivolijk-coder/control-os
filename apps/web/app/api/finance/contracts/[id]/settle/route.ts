import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';
import { FinancialContractError, settleFinancialContract } from '@/services/finance-contracts';

/**
 * `POST /api/finance/contracts/:id/settle` — "quitação antecipada" (Fase 3,
 * seção 3). Mesma composição de `installments/:id/pay` e `/undo-pay`: uma
 * rota por ação de estado, delega inteiramente pro service (que já garante
 * ownership via `userId` da sessão, nunca do corpo da requisição, e roda
 * dentro de `prisma.$transaction` Serializable).
 */
export async function POST(request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ success: false, message: 'Faça login para quitar o contrato.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { settledAt?: unknown };
  const settledAt = typeof body.settledAt === 'string' && !Number.isNaN(new Date(body.settledAt).getTime()) ? body.settledAt : undefined;
  if (body.settledAt !== undefined && !settledAt) {
    return NextResponse.json({ success: false, message: 'A data de quitação informada é inválida.' }, { status: 400 });
  }

  try {
    const result = await runAsFinanceUser(userId, () => settleFinancialContract({ userId, contractId: params.id, settledAt, source: 'manual' }));
    return NextResponse.json({ success: true, ...result });
  } catch (cause) {
    if (cause instanceof FinancialContractError) return NextResponse.json({ success: false, message: cause.message }, { status: cause.status });
    console.error('Falha ao quitar contrato financeiro:', cause);
    return NextResponse.json({ success: false, message: 'Não foi possível quitar o contrato agora.' }, { status: 500 });
  }
}
