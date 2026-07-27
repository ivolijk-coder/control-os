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
 * A NOVA usa a mesma API autenticada e o mesmo `FinanceService` da interface
 * manual; não há escrita paralela nem confirmação prematura ao usuário.
 */
export class CreateIncomeAction implements Action {
  constructor(private readonly input: CreateIncomeInput) {}

  async execute(_ctx: NovaContext): Promise<NovaActionResult[]> {
    const result = await postFinanceAction('income.create', {
      amount: this.input.amount,
      description: this.input.description,
      categoryId: 'default:Salário',
      idempotencyKey: createIdempotencyKey(),
    });
    return [{ action: { kind: 'criar_receita', label: 'Registrar receita' }, ok: result.success, detail: result.message }];
  }
}

function createIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `nova-income-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
