import { createExpense } from '@/services/nova';
import type { NovaActionResult, NovaContext } from '@/services/nova';
import { postFinanceAction } from '../finance-bridge';
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
 *
 * CONTROL OS — Fase 7 (Financeiro completo): além da escrita síncrona em
 * `useDataStore` (inalterada — é o que a UI lê imediatamente), também
 * dispara `postFinanceAction('expense.create', ...)` (fire-and-forget, ver
 * `services/ai/finance-bridge.ts`) para persistir o MESMO lançamento de
 * verdade via Prisma. Ponte deliberadamente não-bloqueante: `execute` é
 * síncrono, então a persistência real roda em paralelo, sem atrasar a
 * resposta ao usuário.
 */
export class CreateExpenseAction implements Action {
  constructor(private readonly input: CreateExpenseInput) {}

  execute(ctx: NovaContext): NovaActionResult[] {
    const results = createExpense(ctx, {
      kind: 'registrar_despesa',
      raw: this.input.description,
      amount: this.input.amount,
      description: this.input.description,
    });

    postFinanceAction('expense.create', { amount: this.input.amount, description: this.input.description });

    return results;
  }
}
