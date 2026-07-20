import type { FinanceService } from '@/services/modules';
import { financeService as defaultFinanceService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { ActionHandler } from '../../action.interfaces';
import { getString } from '../../payload-guards';

export class DeleteIncomeAction implements ActionHandler {
  readonly kind: ActionKind = 'income.delete';

  readonly capability: Capability = {
    kind: 'income.delete',
    description: 'Remove uma receita já registrada do usuário.',
    parameters: [{ name: 'id', type: 'string', required: true, description: 'Identificador da receita a remover.' }],
    examples: ['Apaga o lançamento do salário -> {"kind":"income.delete","confidence":0.8,"parameters":{"id":"inc_1"}}'],
  };

  constructor(private readonly financeService: FinanceService = defaultFinanceService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const id = getString(payload, 'id');
    if (!id) {
      return { success: false, message: 'Preciso do "id" da receita para removê-la.' };
    }
    return this.financeService.deleteIncome({ id });
  }
}
