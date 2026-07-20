import type { FinanceService } from '@/services/modules';
import { financeService as defaultFinanceService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { ActionHandler } from '../../action.interfaces';
import { getNumber, getString } from '../../payload-guards';

export class UpdateExpenseAction implements ActionHandler {
  readonly kind: ActionKind = 'expense.update';

  constructor(private readonly financeService: FinanceService = defaultFinanceService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const id = getString(payload, 'id');
    if (!id) {
      return { success: false, message: 'Preciso do "id" da despesa para atualizá-la.' };
    }
    return this.financeService.updateExpense({
      id,
      amount: getNumber(payload, 'amount') ?? getNumber(payload, 'value'),
      description: getString(payload, 'description'),
      category: getString(payload, 'category'),
      date: getString(payload, 'date'),
    });
  }
}
