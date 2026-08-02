import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { getFinancialDashboard } from '@/services/finance-contracts';

/**
 * `GET /api/finance/contracts/dashboard` — cards + blocos inteligentes
 * (seções 6/7 do script "Parcelas & Empréstimos"). Segmento literal
 * `dashboard` antes de `[id]` — o App Router resolve rotas estáticas com
 * prioridade sobre dinâmicas, mesma composição de `app/api/finance/
 * fixed-account-occurrences/[id]/pay` ao lado da rota base.
 */
export async function GET(): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ success: false, message: 'Faça login para consultar o painel.' }, { status: 401 });

  try {
    const dashboard = await getFinancialDashboard(userId);
    return NextResponse.json({ success: true, dashboard });
  } catch (cause) {
    console.error('Falha ao montar o painel de Parcelas & Empréstimos:', cause);
    return NextResponse.json({ success: false, message: 'Não foi possível carregar o painel agora.' }, { status: 500 });
  }
}
