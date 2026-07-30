import type { FinanceTransactionFilters } from '@control-os/types';
import { serializeFinanceTransactionFilters } from './finance-api-client';

export const financeKeys = {
  all: ['finance'] as const,
  dashboard: () => [...financeKeys.all, 'dashboard'] as const,
  transactions: () => [...financeKeys.all, 'transactions'] as const,
  transactionLists: () => [...financeKeys.transactions(), 'list'] as const,
  transactionList: (filters: FinanceTransactionFilters = {}) =>
    [...financeKeys.transactionLists(), serializeFinanceTransactionFilters(filters)] as const,
  transactionDetails: () => [...financeKeys.transactions(), 'detail'] as const,
  transaction: (id: string) => [...financeKeys.transactionDetails(), id] as const,
  accounts: () => [...financeKeys.all, 'accounts'] as const,
  accountList: (includeArchived = false) => [...financeKeys.accounts(), { includeArchived }] as const,
  categories: () => [...financeKeys.all, 'categories'] as const,
  categoryList: (includeArchived = false) => [...financeKeys.categories(), { includeArchived }] as const,
};
