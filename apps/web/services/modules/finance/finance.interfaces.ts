import type { FinanceEntry } from '@control-os/types';
import type { ActionResult } from '@/services/action-result.types';
import type {
  CreateExpenseInput,
  CreateIncomeInput,
  DeleteExpenseInput,
  DeleteIncomeInput,
  FinanceSummary,
  UpdateExpenseInput,
  UpdateIncomeInput,
} from './finance.types';

/**
 * Contrato do módulo Financeiro — "cada Service depende apenas de
 * interfaces". As Actions (`services/action-engine/actions/finance/`)
 * dependem só disto, nunca de `PersistentFinanceService` diretamente.
 *
 * Fase 6 (Persistência real): ganha Receitas (`*Income`) e Consultas
 * (`getBalance`/`getMonthlyExpenses`/`getMonthlyIncome`/`getSummary`) —
 * "Substituir completamente o MockFinanceService... Implementar: Receitas,
 * Despesas, Consultas." `create*`/`update*`/`delete*` continuam devolvendo
 * `ActionResult` (formato de execução, usado pelas Actions); as consultas
 * devolvem dado de domínio puro (`FinanceEntry[]`/`FinanceSummary`) — não
 * são Actions, são leitura, "Ainda NÃO implementar: Dashboard/Relatórios"
 * não impede o dado existir para quando esse consumidor chegar.
 */
export interface FinanceService {
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

  // Consultas
  getBalance(): Promise<number>;
  getMonthlyExpenses(reference?: Date): Promise<FinanceEntry[]>;
  getMonthlyIncome(reference?: Date): Promise<FinanceEntry[]>;
  getSummary(reference?: Date): Promise<FinanceSummary>;
}
