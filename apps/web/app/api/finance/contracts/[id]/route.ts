import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { buildFinancialContractSummary, getFinancialContract } from '@/services/finance-contracts';

/**
 * `GET /api/finance/contracts/:id` — contrato + resumo ("contract detail",
 * Fase 3, seção 1). `summary` é aditivo ao lado de `contract`: nenhum
 * consumidor existente que só lê `.contract` quebra (não criamos um
 * endpoint novo pra isso — a doc pede "contrato + resumo", este JÁ é o
 * endpoint de detalhe de um contrato).
 */
export async function GET(_request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ success: false, message: 'Faça login para consultar o contrato.' }, { status: 401 });

  try {
    const contract = await getFinancialContract(userId, params.id);
    if (!contract) return NextResponse.json({ success: false, message: 'Contrato não encontrado.' }, { status: 404 });
    const summary = buildFinancialContractSummary(contract);
    return NextResponse.json({ success: true, contract, summary });
  } catch (cause) {
    console.error('Falha ao consultar contrato financeiro:', cause);
    return NextResponse.json({ success: false, message: 'Não foi possível carregar o contrato agora.' }, { status: 500 });
  }
}
