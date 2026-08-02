'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  financialContractsApiClient,
  type CreateFinancialContractInput,
} from './finance-contracts-api-client';
import { financialContractsKeys } from './finance-contracts-query-keys';

export function useFinancialContracts() {
  return useQuery({
    queryKey: financialContractsKeys.lists(),
    queryFn: ({ signal }) => financialContractsApiClient.listContracts(signal),
  });
}

export function useFinancialContract(id: string | undefined) {
  return useQuery({
    queryKey: financialContractsKeys.detail(id ?? ''),
    queryFn: ({ signal }) => financialContractsApiClient.getContract(id as string, signal),
    enabled: Boolean(id),
  });
}

export function useFinancialContractsDashboard() {
  return useQuery({
    queryKey: financialContractsKeys.dashboard(),
    queryFn: ({ signal }) => financialContractsApiClient.getDashboard(signal),
  });
}

async function invalidateFinancialContractsQueries(queryClient: ReturnType<typeof useQueryClient>): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: financialContractsKeys.lists() }),
    queryClient.invalidateQueries({ queryKey: financialContractsKeys.details() }),
    queryClient.invalidateQueries({ queryKey: financialContractsKeys.dashboard() }),
  ]);
}

export function useCreateFinancialContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFinancialContractInput) => financialContractsApiClient.createContract(input),
    onSuccess: () => invalidateFinancialContractsQueries(queryClient),
  });
}
