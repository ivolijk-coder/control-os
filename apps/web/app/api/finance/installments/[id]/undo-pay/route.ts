import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';
import { FinancialContractError, undoFinancialInstallmentPayment } from '@/services/finance-contracts';

/** `POST /api/finance/installments/:id/undo-pay` — "Desfazer pagamento" (seção 5 do script). Nunca apaga: estorna. */
export async function POST(_request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ success: false, message: 'Faça login para desfazer o pagamento.' }, { status: 401 });

  try {
    const result = await runAsFinanceUser(userId, () => undoFinancialInstallmentPayment({ userId, installmentId: params.id, source: 'manual' }));
    return NextResponse.json({ success: true, ...result });
  } catch (cause) {
    if (cause instanceof FinancialContractError) return NextResponse.json({ success: false, message: cause.message }, { status: cause.status });
    console.error('Falha ao desfazer pagamento da parcela:', cause);
    return NextResponse.json({ success: false, message: 'Não foi possível desfazer o pagamento agora.' }, { status: 500 });
  }
}
