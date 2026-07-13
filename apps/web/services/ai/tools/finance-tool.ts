import type { NovaActionResult, NovaContext } from '@/services/nova';
import { CreateExpenseAction, CreateIncomeAction, type CreateExpenseInput, type CreateIncomeInput } from '../actions';

/** Ferramenta de Financeiro — despesas e receitas. Hoje só chama as Actions correspondentes. */
export class FinanceTool {
  registerExpense(ctx: NovaContext, input: CreateExpenseInput): NovaActionResult[] {
    return new CreateExpenseAction(input).execute(ctx);
  }

  registerIncome(ctx: NovaContext, input: CreateIncomeInput): NovaActionResult[] {
    return new CreateIncomeAction(input).execute(ctx);
  }
}
