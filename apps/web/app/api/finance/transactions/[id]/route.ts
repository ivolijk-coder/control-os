import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { financeService } from '@/services/modules';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';
import { FinanceQueryError } from '@/services/modules/finance/finance-query';

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
function failure(message: string, status: number): NextResponse { return NextResponse.json({ success: false, message }, { status }); }
function text(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value.trim() : undefined; }
function date(value: unknown): string | undefined { return value === undefined ? undefined : typeof value === 'string' && !Number.isNaN(new Date(value).getTime()) ? value : undefined; }

export async function GET(_request: NextRequest, context: { params: { id: string } }): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return failure('Faça login para consultar uma transação.', 401);
  if (!isUuid(context.params.id)) return failure('Transação não encontrada.', 404);
  try {
    const transaction = await runAsFinanceUser(userId, () => financeService.getTransactionById(context.params.id));
    return NextResponse.json({ success: true, transaction });
  } catch (cause) {
    if (cause instanceof FinanceQueryError && cause.code === 'not_found') return failure('Transação não encontrada.', 404);
    console.error('Falha ao consultar transação:', cause);
    return failure('Não foi possível carregar a transação agora.', 500);
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

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
