import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { FinanceEntryType, FinanceTransactionFilters, FinanceTransactionSort, FinanceTransactionSource, FinanceTransactionStatus } from '@control-os/types';
import { currentSessionUserId } from '@/services/auth/session';
import { financeService } from '@/services/modules';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';
import { FinanceQueryError } from '@/services/modules/finance/finance-query';

const TYPES: readonly FinanceEntryType[] = ['receita', 'despesa', 'transferencia'];
const STATUSES: readonly FinanceTransactionStatus[] = ['pendente', 'confirmada', 'cancelada', 'estornada'];
const SOURCES: readonly FinanceTransactionSource[] = ['manual', 'nova', 'whatsapp', 'api'];
const SORTS: readonly FinanceTransactionSort[] = ['date_desc', 'date_asc'];

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
  const search = request.nextUrl.searchParams;
  const type = member(search.get('type'), TYPES);
  const status = member(search.get('status'), STATUSES);
  const origin = member(search.get('origin'), SOURCES);
  const sort = member(search.get('sort'), SORTS);
  if (search.has('type') && !type) return failure('Tipo de transação inválido.', 400);
  if (search.has('status') && !status) return failure('Status de transação inválido.', 400);
  if (search.has('origin') && !origin) return failure('Origem de transação inválida.', 400);
  if (search.has('sort') && !sort) return failure('Ordenação inválida.', 400);
  const accountId = optional(search.get('accountId'));
  const categoryId = optional(search.get('categoryId'));
  if (accountId && !isUuid(accountId)) return failure('Conta inválida.', 400);
  if (categoryId && !isUuid(categoryId)) return failure('Categoria inválida.', 400);
  const rawLimit = search.get('limit');
  const limit = rawLimit === null ? undefined : Number(rawLimit);
  const filters: FinanceTransactionFilters = {
    cursor: optional(search.get('cursor')),
    limit,
    type,
    status,
    accountId,
    categoryId,
    origin,
    competenceFrom: optional(search.get('competenceFrom')),
    competenceTo: optional(search.get('competenceTo')),
    dueDateFrom: optional(search.get('dueDateFrom')),
    dueDateTo: optional(search.get('dueDateTo')),
    search: optional(search.get('search')),
    sort,
  };
  try {
    const page = await runAsFinanceUser(userId, () => financeService.listTransactionsPaginated(filters));
    return NextResponse.json({ success: true, ...page });
  } catch (cause) {
    if (cause instanceof FinanceQueryError) return failure(cause.message, 400);
    console.error('Falha ao consultar transações:', cause);
    return failure('Não foi possível carregar as transações agora.', 500);
  }
}

function optional(value: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function member<T extends string>(value: string | null, values: readonly T[]): T | undefined {
  return value !== null && values.some((candidate) => candidate === value) ? values.find((candidate) => candidate === value) : undefined;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
