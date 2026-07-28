import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { financeService } from '@/services/modules';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';

/**
 * Visão financeira da home. Os indicadores são calculados em tempo de
 * consulta a partir do núcleo de transações e das ocorrências; não há
 * totais persistidos nem dados demonstrativos nesta rota.
 */
export async function GET(): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ success: false, message: 'Faça login para consultar o painel.' }, { status: 401 });

  try {
    const payload = await runAsFinanceUser(userId, async () => {
      const [dashboard, occurrences] = await Promise.all([
        financeService.getDashboard(),
        financeService.listFixedAccountOccurrences(),
      ]);
      const today = new Date();
      const dayKey = today.toISOString().slice(0, 10);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowKey = tomorrow.toISOString().slice(0, 10);
      const competence = dayKey.slice(0, 7);
      const pending = occurrences.filter((occurrence) => occurrence.status === 'pendente' || occurrence.status === 'parcial');
      return {
        dashboard,
        fixedAccounts: {
          overdue: pending.filter((occurrence) => occurrence.dueDate.slice(0, 10) < dayKey),
          dueToday: pending.filter((occurrence) => occurrence.dueDate.slice(0, 10) === dayKey),
          dueTomorrow: pending.filter((occurrence) => occurrence.dueDate.slice(0, 10) === tomorrowKey),
          paidThisMonth: occurrences.filter((occurrence) => occurrence.status === 'paga' && occurrence.referencePeriod === competence),
          plannedThisMonth: occurrences.filter((occurrence) => occurrence.referencePeriod === competence),
        },
      };
    });
    return NextResponse.json({ success: true, ...payload });
  } catch (error) {
    console.error('Falha ao montar visão financeira:', error);
    return NextResponse.json({ success: false, message: 'Não foi possível carregar os dados financeiros agora.' }, { status: 500 });
  }
}
