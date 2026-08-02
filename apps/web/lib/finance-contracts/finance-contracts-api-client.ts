import { FinanceApiError } from '@/lib/finance/finance-api-client';

/**
 * Cliente HTTP da evolução "Parcelas & Empréstimos" (Fase 2) — mesmo padrão
 * de `lib/finance/finance-api-client.ts`: reaproveita `FinanceApiError` de
 * lá (mesmo contrato de erro do domínio financeiro, sem duplicar), nada
 * novo inventado.
 */

export type FinancialContractType = 'LOAN' | 'FINANCING' | 'CARD_INSTALLMENT' | 'SUPPLIER';
export type FinancialContractOrigin = 'PERSONAL' | 'COMPANY';
export type FinancialContractSource = 'MANUAL' | 'NOVA' | 'DOCUMENT';
export type FinancialContractStatus = 'ACTIVE' | 'FINISHED' | 'CANCELLED';
export type FinancialInstallmentStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export type FinancialInstallmentDto = {
  id: string;
  contractId: string;
  number: number;
  amount: number;
  dueDate: string;
  status: FinancialInstallmentStatus;
  paidAt: string | null;
  paymentTransactionId: string | null;
  createdAt: string;
};

export type FinancialContractDto = {
  id: string;
  userId: string;
  name: string;
  institution: string | null;
  type: FinancialContractType;
  origin: FinancialContractOrigin;
  categoryId: string | null;
  accountId: string | null;
  totalAmount: number;
  financedAmount: number | null;
  installmentAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  dueDay: number;
  startDate: string;
  endDate: string | null;
  interestRate: number | null;
  status: FinancialContractStatus;
  source: FinancialContractSource;
  documentId: string | null;
  createdAt: string;
  updatedAt: string;
  installments?: FinancialInstallmentDto[];
};

export type FinancialInstallmentWithContractDto = FinancialInstallmentDto & {
  contractName: string;
  contractInstitution: string | null;
};

export type FinancialDashboardDto = {
  outstandingBalance: { count: number; total: number };
  dueThisMonth: { count: number; total: number; items: FinancialInstallmentWithContractDto[] };
  paidThisMonth: { count: number; total: number };
  pending: { count: number; total: number };
  dueToday: FinancialInstallmentWithContractDto[];
  dueThisWeek: FinancialInstallmentWithContractDto[];
  overdue: { count: number; total: number; items: FinancialInstallmentWithContractDto[] };
};

export type CreateFinancialContractInput = {
  name: string;
  institution?: string;
  type: FinancialContractType;
  origin?: FinancialContractOrigin;
  categoryId?: string;
  accountId?: string;
  totalAmount: number;
  financedAmount?: number;
  totalInstallments: number;
  installmentAmount?: number;
  dueDay: number;
  startDate?: string;
  endDate?: string;
  interestRate?: number;
  source?: FinancialContractSource;
  documentId?: string;
};

export type PayFinancialInstallmentResult = {
  alreadyPaid: boolean;
  installment: FinancialInstallmentDto;
  contract: FinancialContractDto;
};

export type UndoFinancialInstallmentPaymentResult = {
  installment: FinancialInstallmentDto;
  contract: FinancialContractDto;
};

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const defaultFetcher: Fetcher = (input, init) => fetch(input, init);

export class FinancialContractsApiClient {
  constructor(private readonly fetcher: Fetcher = defaultFetcher) {}

  async listContracts(signal?: AbortSignal): Promise<FinancialContractDto[]> {
    const payload = await this.request<{ contracts: FinancialContractDto[] }>('/api/finance/contracts', { signal });
    return payload.contracts;
  }

  async getContract(id: string, signal?: AbortSignal): Promise<FinancialContractDto> {
    const payload = await this.request<{ contract: FinancialContractDto }>(`/api/finance/contracts/${encodeURIComponent(id)}`, { signal });
    return payload.contract;
  }

  async getDashboard(signal?: AbortSignal): Promise<FinancialDashboardDto> {
    const payload = await this.request<{ dashboard: FinancialDashboardDto }>('/api/finance/contracts/dashboard', { signal });
    return payload.dashboard;
  }

  async createContract(input: CreateFinancialContractInput, signal?: AbortSignal): Promise<FinancialContractDto> {
    const payload = await this.request<{ contract: FinancialContractDto }>('/api/finance/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    });
    return payload.contract;
  }

  async payInstallment(id: string, paidAt?: string, signal?: AbortSignal): Promise<PayFinancialInstallmentResult> {
    return this.request<PayFinancialInstallmentResult>(`/api/finance/installments/${encodeURIComponent(id)}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paidAt ? { paidAt } : {}),
      signal,
    });
  }

  async undoInstallmentPayment(id: string, signal?: AbortSignal): Promise<UndoFinancialInstallmentPaymentResult> {
    return this.request<UndoFinancialInstallmentPaymentResult>(`/api/finance/installments/${encodeURIComponent(id)}/undo-pay`, {
      method: 'POST',
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
      throw new FinanceApiError(failure.message ?? 'Não foi possível concluir a operação.', response.status, failure.code);
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

function isSuccess(value: unknown): value is { success: true } & Record<string, unknown> {
  return typeof value === 'object' && value !== null && 'success' in value && value.success === true;
}

function asFailure(value: unknown): { message?: string; code?: string } {
  if (typeof value !== 'object' || value === null) return {};
  const candidate = value as Record<string, unknown>;
  return {
    message: typeof candidate.message === 'string' ? candidate.message : undefined,
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
  };
}

export const financialContractsApiClient = new FinancialContractsApiClient();
