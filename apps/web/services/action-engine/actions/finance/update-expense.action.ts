import type { FinanceService } from '@/services/modules';
import { financeService as defaultFinanceService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { ActionHandler } from '../../action.interfaces';
import { getNumber, getString } from '../../payload-guards';

export class UpdateExpenseAction implements ActionHandler {
  readonly kind: ActionKind = 'expense.update';

  readonly capability: Capability = {
    kind: 'expense.update',
    description: 'Atualiza uma despesa já registrada do usuário.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Identificador da despesa a atualizar.' },
      { name: 'value', type: 'number', required: false, description: 'Novo valor, se estiver mudando.' },
      { name: 'description', type: 'string', required: false, description: 'Nova descrição, se estiver mudando.' },
      { name: 'category', type: 'string', required: false, description: 'Nova categoria, se estiver mudando.' },
      { name: 'date', type: 'string', required: false, description: 'Nova data (AAAA-MM-DD), se estiver mudando.' },
    ],
    examples: [
      'Corrige a despesa do mercado pra 380 -> {"kind":"expense.update","confidence":0.75,"parameters":{"id":"exp_1","value":380}}',
    ],
  };

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
