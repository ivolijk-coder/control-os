import type { FinanceService } from '@/services/modules';
import { financeService as defaultFinanceService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { ActionHandler } from '../../action.interfaces';
import { getString } from '../../payload-guards';

export class DeleteExpenseAction implements ActionHandler {
  readonly kind: ActionKind = 'expense.delete';

  readonly capability: Capability = {
    kind: 'expense.delete',
    description: 'Remove uma despesa já registrada do usuário.',
    parameters: [{ name: 'id', type: 'string', required: true, description: 'Identificador da despesa a remover.' }],
    examples: ['Apaga a despesa do mercado -> {"kind":"expense.delete","confidence":0.8,"parameters":{"id":"exp_1"}}'],
  };

  constructor(private readonly financeService: FinanceService = defaultFinanceService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const id = getString(payload, 'id');
    if (!id) {
      return { success: false, message: 'Preciso do "id" da despesa para removê-la.' };
    }
    return this.financeService.deleteExpense({ id });
  }
}
