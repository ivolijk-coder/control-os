import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { getFinancialContract } from '@/services/finance-contracts';

export async function GET(_request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ success: false, message: 'Faça login para consultar o contrato.' }, { status: 401 });

  try {
    const contract = await getFinancialContract(userId, params.id);
    if (!contract) return NextResponse.json({ success: false, message: 'Contrato não encontrado.' }, { status: 404 });
    return NextResponse.json({ success: true, contract });
  } catch (cause) {
    console.error('Falha ao consultar contrato financeiro:', cause);
    return NextResponse.json({ success: false, message: 'Não foi possível carregar o contrato agora.' }, { status: 500 });
  }
}
