import type {
  FinanceAccount,
  FinanceCategory,
  FinanceEntry,
  FinanceTransactionDto,
  FinanceTransactionFilters,
  FixedAccountOccurrence,
  PaginatedFinanceTransactions,
} from '@control-os/types';

export interface FinanceAccountDto extends FinanceAccount {
  balance: number;
}

export interface FinanceCategoryBreakdownDto {
  category: string;
  total: number;
}

export interface FinanceCashFlowPointDto {
  year: number;
  month: number;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

export interface FinanceDashboardDto {
  currentBalance: number;
  monthIncome: number;
  monthExpenses: number;
  savings: number;
  topExpenseCategories: FinanceCategoryBreakdownDto[];
  recentTransactions: FinanceEntry[];
  monthlyEvolution: FinanceCashFlowPointDto[];
}

export interface FinanceDashboardPayload {
  dashboard: FinanceDashboardDto;
  fixedAccounts: {
    overdue: FixedAccountOccurrence[];
    dueToday: FixedAccountOccurrence[];
    dueTomorrow: FixedAccountOccurrence[];
    paidThisMonth: FixedAccountOccurrence[];
    plannedThisMonth: FixedAccountOccurrence[];
  };
}

export interface CreateFinanceTransactionInput {
  type: 'receita' | 'despesa' | 'transferencia';
  amount: number;
  description?: string;
  categoryId?: string;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  competenceDate?: string;
  dueDate?: string;
  paidAt?: string;
  status?: 'pendente' | 'confirmada' | 'cancelada' | 'estornada';
  idempotencyKey?: string;
}

export interface UpdateFinanceTransactionInput {
  id: string;
  amount?: number;
  description?: string;
  categoryId?: string;
  accountId?: string;
  competenceDate?: string;
  dueDate?: string;
}

export interface FinanceMutationResult {
  success: true;
  message: string;
  data?: unknown;
}

interface ApiFailure {
  success?: false;
  message?: string;
  code?: string;
}

interface ApiSuccess {
  success: true;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const defaultFetcher: Fetcher = (input, init) => fetch(input, init);

export class FinanceApiError extends Error {
  readonly code?: string;
  readonly status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'FinanceApiError';
    this.status = status;
    this.code = code;
  }
}

const FILTER_ORDER: readonly (keyof FinanceTransactionFilters)[] = [
  'cursor',
  'limit',
  'type',
  'status',
  'accountId',
  'categoryId',
  'origin',
  'competenceFrom',
  'competenceTo',
  'dueDateFrom',
  'dueDateTo',
  'search',
  'sort',
];

export function serializeFinanceTransactionFilters(filters: FinanceTransactionFilters = {}): string {
  const query = new URLSearchParams();
  for (const key of FILTER_ORDER) {
    const value = filters[key];
    if (value === undefined || value === null || value === '') continue;
    query.set(key, String(value));
  }
  return query.toString();
}

export class FinanceApiClient {
  constructor(private readonly fetcher: Fetcher = defaultFetcher) {}

  async getDashboard(signal?: AbortSignal): Promise<FinanceDashboardPayload> {
    const payload = await this.request<ApiSuccess & FinanceDashboardPayload>('/api/finance/dashboard', { signal });
    return { dashboard: payload.dashboard, fixedAccounts: payload.fixedAccounts };
  }

  async listTransactions(filters: FinanceTransactionFilters = {}, signal?: AbortSignal): Promise<PaginatedFinanceTransactions> {
    const query = serializeFinanceTransactionFilters(filters);
    const payload = await this.request<ApiSuccess & PaginatedFinanceTransactions>(
      `/api/finance/transactions${query ? `?${query}` : ''}`,
      { signal }
    );
    return { items: payload.items, nextCursor: payload.nextCursor, hasMore: payload.hasMore };
  }

  async getTransaction(id: string, signal?: AbortSignal): Promise<FinanceTransactionDto> {
    const payload = await this.request<ApiSuccess & { transaction: FinanceTransactionDto }>(
      `/api/finance/transactions/${encodeURIComponent(id)}`,
      { signal }
    );
    return payload.transaction;
  }

  async listAccounts(includeArchived = false, signal?: AbortSignal): Promise<FinanceAccountDto[]> {
    const payload = await this.request<ApiSuccess & { accounts: FinanceAccountDto[] }>(
      `/api/finance/accounts?includeArchived=${String(includeArchived)}`,
      { signal }
    );
    return payload.accounts;
  }

  async listCategories(includeArchived = false, signal?: AbortSignal): Promise<FinanceCategory[]> {
    const payload = await this.request<ApiSuccess & { categories: FinanceCategory[] }>(
      `/api/finance/categories?includeArchived=${String(includeArchived)}`,
      { signal }
    );
    return payload.categories;
  }

  createTransaction(input: CreateFinanceTransactionInput, signal?: AbortSignal): Promise<FinanceMutationResult> {
    const { idempotencyKey, ...body } = input;
    return this.request<FinanceMutationResult>('/api/finance/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
  }

  updateTransaction(input: UpdateFinanceTransactionInput, signal?: AbortSignal): Promise<FinanceMutationResult> {
    const { id, ...changes } = input;
    return this.patchTransaction(id, { action: 'update', ...changes }, signal);
  }

  confirmTransaction(id: string, signal?: AbortSignal): Promise<FinanceMutationResult> {
    return this.patchTransaction(id, { action: 'confirm' }, signal);
  }

  cancelTransaction(id: string, signal?: AbortSignal): Promise<FinanceMutationResult> {
    return this.patchTransaction(id, { action: 'cancel' }, signal);
  }

  reverseTransaction(id: string, signal?: AbortSignal): Promise<FinanceMutationResult> {
    return this.patchTransaction(id, { action: 'reverse' }, signal);
  }

  private patchTransaction(id: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<FinanceMutationResult> {
    return this.request<FinanceMutationResult>(`/api/finance/transactions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher(url, init);
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') throw cause;
      throw new FinanceApiError('Não foi possível conectar ao serviço financeiro.', 0, 'network_error');
    }

    const payload = await parsePayload(response);
    if (!response.ok || !isSuccess(payload)) {
      const failure = asFailure(payload);
      throw new FinanceApiError(
        failure.message ?? 'Não foi possível concluir a operação financeira.',
        response.status,
        failure.code
      );
    }
    return payload as T;
  }
}

async function parsePayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new FinanceApiError('O serviço financeiro retornou uma resposta inválida.', response.status, 'invalid_response');
  }
}

function isSuccess(value: unknown): value is ApiSuccess & Record<string, unknown> {
  return typeof value === 'object' && value !== null && 'success' in value && value.success === true;
}

function asFailure(value: unknown): ApiFailure {
  if (typeof value !== 'object' || value === null) return {};
  const candidate = value as Record<string, unknown>;
  return {
    success: false,
    message: typeof candidate.message === 'string' ? candidate.message : undefined,
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
  };
}

export const financeApiClient = new FinanceApiClient();
