import type { NovaActionResult, NovaContext } from '@/services/nova';
import { postFinanceAction } from '../finance-bridge';
import type { Action } from './types';

export interface CreateExpenseInput {
  amount: number;
  description: string;
  accountName?: string;
  category?: string;
}

/**
 * Comando "registrar uma despesa" — resolvido pelo `IntentResolver` a
 * partir da intent `registrar_despesa`. Reaproveita `createExpense`
 * (`services/nova/actions/create-expense.ts`), já comprovada em produção
 * (grava `FinanceEntry` + evento na Timeline); esta classe só empacota o
 * input num `ExpenseIntent` sintético, sem duplicar a lógica de gravação.
 *
 * A NOVA não grava em store local nem no banco diretamente: ela chama a API
 * autenticada, que delega ao mesmo `FinanceService` usado pela tela manual.
 * A resposta só é considerada bem-sucedida depois que a persistência conclui.
 */
export class CreateExpenseAction implements Action {
  constructor(private readonly input: CreateExpenseInput) {}

  async execute(_ctx: NovaContext): Promise<NovaActionResult[]> {
    const result = await postFinanceAction('expense.create', {
      amount: this.input.amount,
      description: this.input.description,
      accountName: this.input.accountName,
      category: this.input.category,
      categoryId: this.input.category ? undefined : 'default:Alimentação',
      idempotencyKey: createIdempotencyKey(),
    });
    return [{ action: { kind: 'criar_despesa', label: 'Registrar despesa' }, ok: result.success, detail: result.message }];
  }
}

function createIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `nova-expense-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
