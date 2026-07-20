import type { FinanceService } from '@/services/modules';
import { financeService as defaultFinanceService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { ActionHandler } from '../../action.interfaces';
import { getNumber, getString } from '../../payload-guards';

/**
 * `expense.create` — "Gastei R$ 350 no supermercado" → `expense.create` →
 * `FinanceService.createExpense()` → resposta, exemplo literal do pedido
 * original.
 */
export class CreateExpenseAction implements ActionHandler {
  readonly kind: ActionKind = 'expense.create';

  constructor(private readonly financeService: FinanceService = defaultFinanceService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const amount = getNumber(payload, 'amount') ?? getNumber(payload, 'value');
    if (amount === undefined) {
      return { success: false, message: 'Não entendi o valor da despesa — preciso de um "amount" (ou "value") numérico.' };
    }
    return this.financeService.createExpense({
      amount,
      description: getString(payload, 'description'),
      category: getString(payload, 'category'),
      date: getString(payload, 'date'),
    });
  }
}
