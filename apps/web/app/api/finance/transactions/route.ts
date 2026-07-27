import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { financeService } from '@/services/modules';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';

const TYPES = ['receita', 'despesa', 'transferencia'] as const;
const STATUSES = ['pendente', 'confirmada'] as const;

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function failure(message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, message }, { status });
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function date(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime()) ? value : undefined;
}

/** API autenticada do núcleo financeiro. A origem é fixada no servidor:
 * nenhuma chamada do navegador pode escolher userId ou fingir ser NOVA. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return failure('Faça login para consultar transações.', 401);
  const requestedStatus = request.nextUrl.searchParams.get('status');
  if (requestedStatus && !STATUSES.includes(requestedStatus as typeof STATUSES[number])) return failure('Status de transação inválido.', 400);
  try {
    const transactions = await runAsFinanceUser(userId, () => financeService.listTransactions());
    const filtered = requestedStatus ? transactions.filter((entry) => entry.status === requestedStatus) : transactions;
    return NextResponse.json({ success: true, transactions: filtered });
  } catch (cause) {
    console.error('Falha ao consultar transações:', cause);
    return failure('Não foi possível carregar as transações agora.', 500);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return failure('Faça login para criar uma transação.', 401);
  const body = object(await request.json().catch(() => undefined));
  const type = text(body?.type);
  if (!body || !type || !(TYPES as readonly string[]).includes(type)) return failure('Informe um tipo de transação válido.', 400);
  const amount = body.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return failure('Informe um valor numérico válido.', 400);
  const status = body.status === undefined ? undefined : text(body.status);
  if (status && !(STATUSES as readonly string[]).includes(status)) return failure('Status de transação inválido.', 400);
  const competenceDate = date(body.competenceDate);
  const dueDate = date(body.dueDate);
  const paidAt = date(body.paidAt);
  if ((body.competenceDate !== undefined && !competenceDate) || (body.dueDate !== undefined && !dueDate) || (body.paidAt !== undefined && !paidAt)) return failure('Uma das datas informadas é inválida.', 400);

  try {
    const result = await runAsFinanceUser(userId, () => financeService.createTransaction({
      type: type as typeof TYPES[number],
      amount,
      description: text(body.description),
      categoryId: text(body.categoryId),
      accountId: text(body.accountId),
      fromAccountId: text(body.fromAccountId),
      toAccountId: text(body.toAccountId),
      competenceDate,
      dueDate,
      paidAt,
      status: status as typeof STATUSES[number] | undefined,
      idempotencyKey: text(request.headers.get('idempotency-key')) ?? text(body.idempotencyKey),
      source: 'manual',
    }));
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (cause) {
    console.error('Falha ao criar transação:', cause);
    return failure('Não foi possível criar a transação agora.', 500);
  }
}
