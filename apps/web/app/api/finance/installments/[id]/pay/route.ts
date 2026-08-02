import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';
import { FinancialContractError, payFinancialInstallment } from '@/services/finance-contracts';

/**
 * `POST /api/finance/installments/:id/pay` — botão "✓ Marcar pago" (seção 4
 * do script). Mesma composição de `app/api/finance/fixed-account-
 * occurrences/[id]/pay/route.ts`: uma rota por ação de estado, não um
 * `action` dentro de um `PATCH` genérico — mais simples de auditar e de
 * mapear 1:1 pro botão da tela.
 */
export async function POST(request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ success: false, message: 'Faça login para marcar a parcela como paga.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { paidAt?: unknown };
  const paidAt = typeof body.paidAt === 'string' && !Number.isNaN(new Date(body.paidAt).getTime()) ? body.paidAt : undefined;
  if (body.paidAt !== undefined && !paidAt) {
    return NextResponse.json({ success: false, message: 'A data de pagamento informada é inválida.' }, { status: 400 });
  }

  try {
    const result = await runAsFinanceUser(userId, () => payFinancialInstallment({ userId, installmentId: params.id, paidAt, source: 'manual' }));
    return NextResponse.json({ success: true, ...result });
  } catch (cause) {
    if (cause instanceof FinancialContractError) return NextResponse.json({ success: false, message: cause.message }, { status: cause.status });
    console.error('Falha ao marcar parcela como paga:', cause);
    return NextResponse.json({ success: false, message: 'Não foi possível marcar a parcela como paga agora.' }, { status: 500 });
  }
}
