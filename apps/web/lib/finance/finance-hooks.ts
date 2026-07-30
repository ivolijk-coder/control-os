'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type { FinanceTransactionFilters } from '@control-os/types';
import {
  financeApiClient,
  type CreateFinanceTransactionInput,
  type FinanceMutationResult,
  type UpdateFinanceTransactionInput,
} from './finance-api-client';
import { financeKeys } from './finance-query-keys';

export function useFinanceDashboard() {
  return useQuery({
    queryKey: financeKeys.dashboard(),
    queryFn: ({ signal }) => financeApiClient.getDashboard(signal),
  });
}

export function useFinanceTransactions(filters: FinanceTransactionFilters = {}) {
  return useQuery({
    queryKey: financeKeys.transactionList(filters),
    queryFn: ({ signal }) => financeApiClient.listTransactions(filters, signal),
  });
}

export function useFinanceTransaction(id: string | undefined) {
  return useQuery({
    queryKey: financeKeys.transaction(id ?? ''),
    queryFn: ({ signal }) => financeApiClient.getTransaction(requiredId(id), signal),
    enabled: Boolean(id),
  });
}

export function useFinanceAccounts(includeArchived = false) {
  return useQuery({
    queryKey: financeKeys.accountList(includeArchived),
    queryFn: ({ signal }) => financeApiClient.listAccounts(includeArchived, signal),
  });
}

export function useFinanceCategories(includeArchived = false) {
  return useQuery({
    queryKey: financeKeys.categoryList(includeArchived),
    queryFn: ({ signal }) => financeApiClient.listCategories(includeArchived, signal),
  });
}

export function useCreateFinanceTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFinanceTransactionInput) => financeApiClient.createTransaction(input),
    onSuccess: () => invalidateFinanceTransactionQueries(queryClient),
  });
}

export function useUpdateFinanceTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateFinanceTransactionInput) => financeApiClient.updateTransaction(input),
    onSuccess: (_result, input) => invalidateFinanceTransactionQueries(queryClient, input.id),
  });
}

export function useConfirmFinanceTransaction() {
  return useTransactionAction((id) => financeApiClient.confirmTransaction(id));
}

export function useCancelFinanceTransaction() {
  return useTransactionAction((id) => financeApiClient.cancelTransaction(id));
}

export function useReverseFinanceTransaction() {
  return useTransactionAction((id) => financeApiClient.reverseTransaction(id));
}

export async function invalidateFinanceTransactionQueries(queryClient: QueryClient, transactionId?: string): Promise<void> {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: financeKeys.dashboard() }),
    queryClient.invalidateQueries({ queryKey: financeKeys.transactionLists() }),
    queryClient.invalidateQueries({ queryKey: financeKeys.accounts() }),
  ];
  if (transactionId) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: financeKeys.transaction(transactionId) }));
  }
  await Promise.all(invalidations);
}

function useTransactionAction(action: (id: string) => Promise<FinanceMutationResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: (_result, id) => invalidateFinanceTransactionQueries(queryClient, id),
  });
}

function requiredId(id: string | undefined): string {
  if (!id) throw new Error('Identificador da transação não informado.');
  return id;
}
