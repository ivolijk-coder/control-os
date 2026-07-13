import { createRevenue } from '@/services/nova';
import type { NovaActionResult, NovaContext } from '@/services/nova';
import type { Action } from './types';

export interface CreateIncomeInput {
  amount: number;
  description: string;
}

/**
 * Comando "registrar uma receita" — resolvido pelo `IntentResolver` a
 * partir da intent `registrar_receita`. Reaproveita `createRevenue`
 * (`services/nova/actions/create-revenue.ts`).
 */
export class CreateIncomeAction implements Action {
  constructor(private readonly input: CreateIncomeInput) {}

  execute(ctx: NovaContext): NovaActionResult[] {
    return createRevenue(ctx, {
      kind: 'registrar_receita',
      raw: this.input.description,
      amount: this.input.amount,
      description: this.input.description,
    });
  }
}
