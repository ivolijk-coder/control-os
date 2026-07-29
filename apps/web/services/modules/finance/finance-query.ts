import type {
  FinanceEntry,
  FinanceEntryType,
  FinanceTransactionDto,
  FinanceTransactionFilters,
  FinanceTransactionSort,
  FinanceTransactionSource,
  FinanceTransactionStatus,
} from '@control-os/types';
import type { FinanceTransactionPageQuery } from '@/services/repositories';

export const DEFAULT_FINANCE_TRANSACTION_PAGE_SIZE = 20;
export const MAX_FINANCE_TRANSACTION_PAGE_SIZE = 100;
export const MAX_FINANCE_TRANSACTION_SEARCH_LENGTH = 120;

export class FinanceQueryError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid_query' | 'invalid_cursor' | 'not_found'
  ) {
    super(message);
    this.name = 'FinanceQueryError';
  }
}

interface CursorPayload {
  v: 1;
  id: string;
  date: string;
  sort: FinanceTransactionSort;
}

const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TYPES: readonly FinanceEntryType[] = ['receita', 'despesa', 'transferencia'];
const STATUSES: readonly FinanceTransactionStatus[] = ['pendente', 'confirmada', 'cancelada', 'estornada'];
const SOURCES: readonly FinanceTransactionSource[] = ['manual', 'nova', 'whatsapp', 'api'];

function validIdentifier(value: string, label: string): string {
  const normalized = value.trim();
  if (!IDENTIFIER_PATTERN.test(normalized)) throw new FinanceQueryError(`${label} inválido.`, 'invalid_query');
  return normalized;
}

function utcBoundary(value: string, label: string, endOfDay: boolean): string {
  if (!DATE_PATTERN.test(value)) throw new FinanceQueryError(`${label} deve usar o formato YYYY-MM-DD.`, 'invalid_query');
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day!, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month! - 1 || parsed.getUTCDate() !== day) {
    throw new FinanceQueryError(`${label} inválida.`, 'invalid_query');
  }
  return parsed.toISOString();
}

function validateRange(from: string | undefined, to: string | undefined, label: string): void {
  if (from && to && from > to) throw new FinanceQueryError(`O intervalo de ${label} é inválido.`, 'invalid_query');
}

function decodeCursor(value: string, expectedSort: FinanceTransactionSort): CursorPayload {
  if (!value || value.length > 512) throw new FinanceQueryError('Cursor inválido.', 'invalid_cursor');
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<CursorPayload>;
    if (
      parsed.v !== 1 ||
      typeof parsed.id !== 'string' ||
      !IDENTIFIER_PATTERN.test(parsed.id) ||
      typeof parsed.date !== 'string' ||
      Number.isNaN(new Date(parsed.date).getTime()) ||
      parsed.sort !== expectedSort
    ) {
      throw new Error('invalid');
    }
    return parsed as CursorPayload;
  } catch {
    throw new FinanceQueryError('Cursor inválido.', 'invalid_cursor');
  }
}

export function encodeFinanceTransactionCursor(entry: Pick<FinanceEntry, 'id' | 'date'>, sort: FinanceTransactionSort): string {
  const payload: CursorPayload = { v: 1, id: entry.id, date: entry.date, sort };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function normalizeFinanceTransactionFilters(filters: FinanceTransactionFilters = {}): FinanceTransactionPageQuery {
  const limit = filters.limit ?? DEFAULT_FINANCE_TRANSACTION_PAGE_SIZE;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_FINANCE_TRANSACTION_PAGE_SIZE) {
    throw new FinanceQueryError(`O limite deve ser um inteiro entre 1 e ${MAX_FINANCE_TRANSACTION_PAGE_SIZE}.`, 'invalid_query');
  }
  const sort = filters.sort ?? 'date_desc';
  if (sort !== 'date_desc' && sort !== 'date_asc') throw new FinanceQueryError('Ordenação inválida.', 'invalid_query');
  if (filters.type && !TYPES.includes(filters.type)) throw new FinanceQueryError('Tipo de transação inválido.', 'invalid_query');
  if (filters.status && !STATUSES.includes(filters.status)) throw new FinanceQueryError('Status de transação inválido.', 'invalid_query');
  if (filters.origin && !SOURCES.includes(filters.origin)) throw new FinanceQueryError('Origem de transação inválida.', 'invalid_query');

  const competenceFrom = filters.competenceFrom ? utcBoundary(filters.competenceFrom, 'Competência inicial', false) : undefined;
  const competenceTo = filters.competenceTo ? utcBoundary(filters.competenceTo, 'Competência final', true) : undefined;
  const dueDateFrom = filters.dueDateFrom ? utcBoundary(filters.dueDateFrom, 'Vencimento inicial', false) : undefined;
  const dueDateTo = filters.dueDateTo ? utcBoundary(filters.dueDateTo, 'Vencimento final', true) : undefined;
  validateRange(competenceFrom, competenceTo, 'competência');
  validateRange(dueDateFrom, dueDateTo, 'vencimento');

  const search = filters.search?.trim();
  if (search && search.length > MAX_FINANCE_TRANSACTION_SEARCH_LENGTH) {
    throw new FinanceQueryError(`A busca deve ter no máximo ${MAX_FINANCE_TRANSACTION_SEARCH_LENGTH} caracteres.`, 'invalid_query');
  }

  return {
    limit,
    sort,
    cursor: filters.cursor ? decodeCursor(filters.cursor, sort) : undefined,
    type: filters.type,
    status: filters.status,
    accountId: filters.accountId ? validIdentifier(filters.accountId, 'Conta') : undefined,
    categoryId: filters.categoryId ? validIdentifier(filters.categoryId, 'Categoria') : undefined,
    source: filters.origin,
    competenceFrom,
    competenceTo,
    dueDateFrom,
    dueDateTo,
    search: search || undefined,
  };
}

export function toFinanceTransactionDto(entry: FinanceEntry): FinanceTransactionDto {
  return {
    id: entry.id,
    type: entry.type,
    description: entry.description,
    amount: entry.amount,
    category: entry.category,
    categoryId: entry.categoryId,
    date: entry.date,
    accountId: entry.accountId,
    status: entry.status ?? 'confirmada',
    source: entry.source ?? 'manual',
    competenceDate: entry.competenceDate,
    dueDate: entry.dueDate,
    paidAt: entry.paidAt,
    confirmedAt: entry.confirmedAt,
    canceledAt: entry.canceledAt,
    reversalOfId: entry.reversalOfId,
    correlationId: entry.correlationId,
    transferGroupId: entry.transferGroupId,
    transferDirection: entry.transferDirection,
    installmentGroupId: entry.installmentGroupId,
    installmentNumber: entry.installmentNumber,
    installmentTotal: entry.installmentTotal,
    recurrenceFrequency: entry.recurrenceFrequency,
  };
}
