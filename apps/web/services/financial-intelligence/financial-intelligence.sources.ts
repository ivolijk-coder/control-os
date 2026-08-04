import 'server-only';

import type { FixedAccountOccurrence } from '@control-os/types';
import { listFinancialContracts } from '@/services/finance-contracts';
import type { FinancialContract } from '@/services/finance-contracts';
import { financeService } from '@/services/modules';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';
import { DefaultFinancialIntelligenceService } from './financial-intelligence.service';

/**
 * Fontes já existentes que a camada de inteligência apenas compõe. Esta
 * interface mantém o serviço testável e impede qualquer acesso a Prisma.
 */
export interface FinancialIntelligenceSources {
  getAvailableBalance(userId: string): Promise<number>;
  listFixedAccountOccurrences(userId: string): Promise<FixedAccountOccurrence[]>;
  listFinancialContracts(userId: string): Promise<FinancialContract[]>;
}

export const financialIntelligenceSources: FinancialIntelligenceSources = {
  getAvailableBalance(userId) {
    return runAsFinanceUser(userId, () => financeService.getBalance());
  },
  listFixedAccountOccurrences(userId) {
    return runAsFinanceUser(userId, () => financeService.listFixedAccountOccurrences());
  },
  listFinancialContracts(userId) {
    return listFinancialContracts(userId);
  },
};

/** Instância server-side pronta para futuros consumidores autenticados. */
export const financialIntelligenceService = new DefaultFinancialIntelligenceService(financialIntelligenceSources);
