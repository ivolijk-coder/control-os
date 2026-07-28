import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { financeService } from '@/services/modules';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';

const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

export async function GET(request: NextRequest) {
  const userId = currentSessionUserId(); if (!userId) return fail('Faça login para consultar contas fixas.', 401);
  const accounts = await runAsFinanceUser(userId, () => financeService.listFixedAccounts({ includeArchived: request.nextUrl.searchParams.get('includeArchived') === 'true' }));
  return NextResponse.json({ success: true, accounts });
}
export async function POST(request: NextRequest) {
  const userId = currentSessionUserId(); if (!userId) return fail('Faça login para criar uma conta fixa.', 401);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !text(body.name) || !text(body.categoryId) || (body.type !== 'receita' && body.type !== 'despesa') || typeof body.amount !== 'number' || typeof body.dueDay !== 'number' || !text(body.startDate)) return fail('Dados da conta fixa inválidos.', 400);
  const result = await runAsFinanceUser(userId, () => financeService.createFixedAccount({ name: text(body.name)!, description: text(body.description), type: body.type as 'receita' | 'despesa', categoryId: text(body.categoryId)!, sourceAccountId: text(body.sourceAccountId), destinationAccountId: text(body.destinationAccountId), paymentMethod: (text(body.paymentMethod) ?? 'conta_bancaria') as never, amount: body.amount as number, recurrence: (text(body.recurrence) ?? 'mensal') as never, customIntervalDays: typeof body.customIntervalDays === 'number' ? body.customIntervalDays : undefined, dueDay: body.dueDay as number, startDate: text(body.startDate)!, endDate: text(body.endDate), source: 'manual' }));
  return NextResponse.json(result, { status: result.success ? 201 : 400 });
}
