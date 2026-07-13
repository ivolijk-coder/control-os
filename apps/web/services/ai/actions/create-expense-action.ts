import { createExpense } from '@/services/nova';
import type { NovaActionResult, NovaContext } from '@/services/nova';
import type { Action } from './types';

export interface CreateExpenseInput {
  amount: number;
  description: string;
}

/**
 * Comando "registrar uma despesa" — resolvido pelo `IntentResolver` a
 * partir da intent `registrar_despesa`. Reaproveita `createExpense`
 * (`services/nova/actions/create-expense.ts`), já comprovada em produção
 * (grava `FinanceEntry` + evento na Timeline); esta classe só empacota o
 * input num `ExpenseIntent` sintético, sem duplicar a lógica de gravação.
 */
export class CreateExpenseAction implements Action {
  constructor(private readonly input: CreateExpenseInput) {}

  execute(ctx: NovaContext): NovaActionResult[] {
    return createExpense(ctx, {
      kind: 'registrar_despesa',
      raw: this.input.description,
      amount: this.input.amount,
      description: this.input.description,
    });
  }
}
