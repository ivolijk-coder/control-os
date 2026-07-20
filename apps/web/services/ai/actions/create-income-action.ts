import { createRevenue } from '@/services/nova';
import type { NovaActionResult, NovaContext } from '@/services/nova';
import { postFinanceAction } from '../finance-bridge';
import type { Action } from './types';

export interface CreateIncomeInput {
  amount: number;
  description: string;
}

/**
 * Comando "registrar uma receita" — resolvido pelo `IntentResolver` a
 * partir da intent `registrar_receita`. Reaproveita `createRevenue`
 * (`services/nova/actions/create-revenue.ts`).
 *
 * CONTROL OS — Fase 7 (Financeiro completo): mesma ponte de persistência
 * real de `CreateExpenseAction` — `postFinanceAction('income.create', ...)`
 * fire-and-forget, ver `services/ai/finance-bridge.ts`.
 */
export class CreateIncomeAction implements Action {
  constructor(private readonly input: CreateIncomeInput) {}

  execute(ctx: NovaContext): NovaActionResult[] {
    const results = createRevenue(ctx, {
      kind: 'registrar_receita',
      raw: this.input.description,
      amount: this.input.amount,
      description: this.input.description,
    });

    postFinanceAction('income.create', { amount: this.input.amount, description: this.input.description });

    return results;
  }
}
