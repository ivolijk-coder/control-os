/**
 * Ponto único de importação do Finance Repository (CONTROL OS — Fase 6).
 * `FinanceService` (`services/modules/finance`) importa só daqui — nunca de
 * `prisma-finance.repository.ts` diretamente. Mesma convenção de
 * `services/action-engine/index.ts`, `services/memory/index.ts`.
 */
import type { FinanceRepository } from './finance-repository.interfaces';
import { PrismaFinanceRepository } from './prisma-finance.repository';

export type { FinanceRepository } from './finance-repository.interfaces';
export type {
  CreateFinanceAccountInput,
  CreateFinanceCategoryInput,
  CreateFinanceInstallmentInput,
  CreateFinanceTransactionInput,
  CreateFinanceTransferInput,
  FinanceAccountBalance,
  FinanceCategoryBreakdownItem,
  FinanceSummary,
  FinanceTransactionFilter,
  UpdateFinanceTransactionInput,
} from './finance-repository.types';
export { PrismaFinanceRepository } from './prisma-finance.repository';
export { InMemoryFinanceRepository } from './in-memory-finance.repository';

/**
 * Composição raiz — "Ela será a única classe que conhece Prisma" continua
 * verdade mesmo aqui: este arquivo só INSTANCIA `PrismaFinanceRepository`,
 * nunca chama nada de `@prisma/client` diretamente. Trocar por
 * `SupabaseFinanceRepository`/`SQLiteFinanceRepository` no futuro é mudar
 * só esta linha — `FinanceService` nunca muda.
 */
export const financeRepository: FinanceRepository = new PrismaFinanceRepository();
