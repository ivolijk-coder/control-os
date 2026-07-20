import type { ActionResult } from '@/services/action-result.types';
import type { CreateExpenseInput, DeleteExpenseInput, UpdateExpenseInput } from './finance.types';

/**
 * Contrato do módulo Financeiro — "cada Service depende apenas de
 * interfaces". As Actions (`services/action-engine/actions/finance/`)
 * dependem só disto, nunca de `MockFinanceService` diretamente.
 */
export interface FinanceService {
  createExpense(input: CreateExpenseInput): Promise<ActionResult>;
  updateExpense(input: UpdateExpenseInput): Promise<ActionResult>;
  deleteExpense(input: DeleteExpenseInput): Promise<ActionResult>;
}
