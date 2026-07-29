import type { FinanceAccount, FinanceCategory, FinanceEntry, FinanceTransactionDto, FinanceTransactionFilters, FixedAccount, FixedAccountOccurrence, PaginatedFinanceTransactions } from '@control-os/types';
import type { ActionResult } from '@/services/action-result.types';
import type {
  CreateExpenseInput,
  CreateFinanceAccountServiceInput,
  UpdateFinanceAccountServiceInput,
  CreateFinanceCategoryServiceInput,
  UpdateFinanceCategoryServiceInput,
  CreateIncomeInput,
  CreateInstallmentInput,
  CreateRecurringInput,
  CreateTransferInput,
  DeleteExpenseInput,
  DeleteIncomeInput,
  FinanceAccountBalance,
  FinanceCashFlowPoint,
  FinanceCategoryBreakdownItem,
  FinanceDashboard,
  FinanceSummary,
  UpdateExpenseInput,
  UpdateIncomeInput,
  CreateTransactionServiceInput,
  UpdateTransactionServiceInput,
  CreateFixedAccountInput,
  UpdateFixedAccountInput,
  FixedAccountOccurrenceQuery,
  PayFixedAccountOccurrenceInput,
} from './finance.types';

/**
 * Contrato do módulo Financeiro — "cada Service depende apenas de
 * interfaces". As Actions (`services/action-engine/actions/finance/`)
 * dependem só disto, nunca de `PersistentFinanceService` diretamente.
 *
 * Fase 7 (Financeiro completo): ganha Transferências, Parcelamentos,
 * Recorrências, Contas, Categorias e o Dashboard (métodos de leitura —
 * "ainda não criar interface gráfica, apenas Services"). Mesmo padrão das
 * fases anteriores: `create*` continua devolvendo `ActionResult` (formato
 * de execução, usado pelas Actions); consultas devolvem dado de domínio
 * puro.
 */
export interface FinanceService {
  // Núcleo oficial de transações (Sprint 2.1)
  createTransaction(input: CreateTransactionServiceInput): Promise<ActionResult>;
  updateTransaction(input: UpdateTransactionServiceInput): Promise<ActionResult>;
  confirmTransaction(id: string, source?: 'manual' | 'nova' | 'whatsapp' | 'api'): Promise<ActionResult>;
  cancelTransaction(id: string, source?: 'manual' | 'nova' | 'whatsapp' | 'api'): Promise<ActionResult>;
  reverseTransaction(id: string, source?: 'manual' | 'nova' | 'whatsapp' | 'api'): Promise<ActionResult>;
  listTransactions(): Promise<FinanceEntry[]>;
  listTransactionsPaginated(filters?: FinanceTransactionFilters): Promise<PaginatedFinanceTransactions>;
  getTransactionById(id: string): Promise<FinanceTransactionDto>;
  // Despesas
  createExpense(input: CreateExpenseInput): Promise<ActionResult>;
  updateExpense(input: UpdateExpenseInput): Promise<ActionResult>;
  deleteExpense(input: DeleteExpenseInput): Promise<ActionResult>;
  listExpenses(): Promise<FinanceEntry[]>;

  // Receitas
  createIncome(input: CreateIncomeInput): Promise<ActionResult>;
  updateIncome(input: UpdateIncomeInput): Promise<ActionResult>;
  deleteIncome(input: DeleteIncomeInput): Promise<ActionResult>;
  listIncome(): Promise<FinanceEntry[]>;

  // Transferências (CONTROL OS — Fase 7)
  createTransfer(input: CreateTransferInput): Promise<ActionResult>;

  // Parcelamentos (CONTROL OS — Fase 7)
  createInstallment(input: CreateInstallmentInput): Promise<ActionResult>;

  // Recorrências (CONTROL OS — Fase 7)
  createRecurring(input: CreateRecurringInput): Promise<ActionResult>;

  // Contas (CONTROL OS — Fase 7)
  createAccount(input: CreateFinanceAccountServiceInput): Promise<ActionResult>;
  listAccounts(options?: { includeArchived?: boolean }): Promise<FinanceAccount[]>;
  updateAccount(input: UpdateFinanceAccountServiceInput): Promise<ActionResult>;
  archiveAccount(id: string, source?: 'manual' | 'nova' | 'whatsapp' | 'api'): Promise<ActionResult>;
  restoreAccount(id: string, source?: 'manual' | 'nova' | 'whatsapp' | 'api'): Promise<ActionResult>;

  // Categorias (CONTROL OS — Fase 7)
  createCategory(input: CreateFinanceCategoryServiceInput): Promise<ActionResult>;
  listCategories(options?: { includeArchived?: boolean }): Promise<FinanceCategory[]>;
  updateCategory(input: UpdateFinanceCategoryServiceInput): Promise<ActionResult>;
  archiveCategory(id: string, source?: 'manual' | 'nova' | 'whatsapp' | 'api'): Promise<ActionResult>;
  restoreCategory(id: string, source?: 'manual' | 'nova' | 'whatsapp' | 'api'): Promise<ActionResult>;

  // Contas fixas e ocorrências (Sprint 3.0)
  createFixedAccount(input: CreateFixedAccountInput): Promise<ActionResult>;
  listFixedAccounts(options?: { includeArchived?: boolean }): Promise<FixedAccount[]>;
  updateFixedAccount(input: UpdateFixedAccountInput): Promise<ActionResult>;
  archiveFixedAccount(id: string, source?: 'manual' | 'nova' | 'whatsapp' | 'api'): Promise<ActionResult>;
  restoreFixedAccount(id: string, source?: 'manual' | 'nova' | 'whatsapp' | 'api'): Promise<ActionResult>;
  generateFixedAccountOccurrences(until?: Date | string): Promise<ActionResult>;
  listFixedAccountOccurrences(query?: FixedAccountOccurrenceQuery): Promise<FixedAccountOccurrence[]>;
  payFixedAccountOccurrence(input: PayFixedAccountOccurrenceInput): Promise<ActionResult>;
  cancelFixedAccountOccurrence(id: string, source?: 'manual' | 'nova' | 'whatsapp' | 'api'): Promise<ActionResult>;

  // Consultas
  getBalance(): Promise<number>;
  getAccountBalance(accountId: string): Promise<number>;
  listAccountBalances(): Promise<FinanceAccountBalance[]>;
  getMonthlyExpenses(reference?: Date): Promise<FinanceEntry[]>;
  getMonthlyIncome(reference?: Date): Promise<FinanceEntry[]>;
  getExpensesByCategory(reference?: Date): Promise<FinanceCategoryBreakdownItem[]>;
  getIncomeByCategory(reference?: Date): Promise<FinanceCategoryBreakdownItem[]>;
  getCashFlow(monthsBack?: number): Promise<FinanceCashFlowPoint[]>;
  getSummary(reference?: Date): Promise<FinanceSummary>;

  // Dashboard (CONTROL OS — Fase 7: "apenas Services", sem UI ainda)
  getDashboard(): Promise<FinanceDashboard>;
}
