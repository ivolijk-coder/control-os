export const financialContractsKeys = {
  all: ['financial-contracts'] as const,
  lists: () => [...financialContractsKeys.all, 'list'] as const,
  details: () => [...financialContractsKeys.all, 'detail'] as const,
  detail: (id: string) => [...financialContractsKeys.details(), id] as const,
  dashboard: () => [...financialContractsKeys.all, 'dashboard'] as const,
};
