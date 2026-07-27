import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { financeService } from '@/services/modules';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
function failure(message: string, status: number): NextResponse { return NextResponse.json({ success: false, message }, { status }); }
function text(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value.trim() : undefined; }
function date(value: unknown): string | undefined { return value === undefined ? undefined : typeof value === 'string' && !Number.isNaN(new Date(value).getTime()) ? value : undefined; }

export async function PATCH(request: NextRequest, context: { params: { id: string } }): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return failure('Faça login para alterar uma transação.', 401);
  const body = object(await request.json().catch(() => undefined));
  if (!body) return failure('Informe a alteração desejada.', 400);
  const id = context.params.id;
  const action = text(body.action) ?? 'update';
  try {
    const result = await runAsFinanceUser(userId, () => {
      if (action === 'confirm') return financeService.confirmTransaction(id, 'manual');
      if (action === 'cancel') return financeService.cancelTransaction(id, 'manual');
      if (action === 'reverse') return financeService.reverseTransaction(id, 'manual');
      if (action !== 'update') return Promise.resolve({ success: false, message: 'Ação de transação inválida.' });
      const competenceDate = date(body.competenceDate);
      const dueDate = date(body.dueDate);
      if ((body.competenceDate !== undefined && !competenceDate) || (body.dueDate !== undefined && !dueDate)) return Promise.resolve({ success: false, message: 'Uma das datas informadas é inválida.' });
      if (body.amount !== undefined && (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount <= 0)) return Promise.resolve({ success: false, message: 'Informe um valor maior que zero.' });
      return financeService.updateTransaction({ id, amount: typeof body.amount === 'number' ? body.amount : undefined, description: text(body.description), categoryId: text(body.categoryId), accountId: text(body.accountId), competenceDate, dueDate, source: 'manual' });
    });
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (cause) {
    console.error('Falha ao alterar transação:', cause);
    return failure('Não foi possível alterar a transação agora.', 500);
  }
}
