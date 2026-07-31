import type {
  FinanceTransactionFilters,
  FinanceTransactionSort,
  FinanceTransactionStatus,
} from '@control-os/types';

export const FINANCE_TRANSACTION_PAGE_SIZE = 20;

export interface TransactionFilterState {
  search: string;
  competenceFrom: string;
  competenceTo: string;
  accountId: string;
  categoryId: string;
  type: '' | 'receita' | 'despesa' | 'transferencia';
  status: '' | FinanceTransactionStatus;
  sort: FinanceTransactionSort;
}

export const INITIAL_TRANSACTION_FILTERS: TransactionFilterState = {
  search: '',
  competenceFrom: '',
  competenceTo: '',
  accountId: '',
  categoryId: '',
  type: '',
  status: '',
  sort: 'date_desc',
};

export function buildFinanceTransactionFilters(
  filters: TransactionFilterState,
  debouncedSearch: string,
  cursor?: string
): FinanceTransactionFilters {
  return {
    cursor,
    limit: FINANCE_TRANSACTION_PAGE_SIZE,
    type: filters.type || undefined,
    status: filters.status || undefined,
    accountId: filters.accountId || undefined,
    categoryId: filters.categoryId || undefined,
    competenceFrom: filters.competenceFrom || undefined,
    competenceTo: filters.competenceTo || undefined,
    search: debouncedSearch.trim() || undefined,
    sort: filters.sort,
  };
}
