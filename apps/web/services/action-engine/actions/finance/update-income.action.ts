import type { FinanceService } from '@/services/modules';
import { financeService as defaultFinanceService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { ActionHandler } from '../../action.interfaces';
import { getNumber, getString } from '../../payload-guards';

export class UpdateIncomeAction implements ActionHandler {
  readonly kind: ActionKind = 'income.update';

  readonly capability: Capability = {
    kind: 'income.update',
    description: 'Atualiza uma receita já registrada do usuário.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Identificador da receita a atualizar.' },
      { name: 'value', type: 'number', required: false, description: 'Novo valor, se estiver mudando.' },
      { name: 'description', type: 'string', required: false, description: 'Nova descrição, se estiver mudando.' },
      { name: 'category', type: 'string', required: false, description: 'Nova categoria, se estiver mudando.' },
      { name: 'date', type: 'string', required: false, description: 'Nova data (AAAA-MM-DD), se estiver mudando.' },
    ],
    examples: [
      'Corrige o salário pra 3200 -> {"kind":"income.update","confidence":0.75,"parameters":{"id":"inc_1","value":3200}}',
    ],
  };

  constructor(private readonly financeService: FinanceService = defaultFinanceService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const id = getString(payload, 'id');
    if (!id) {
      return { success: false, message: 'Preciso do "id" da receita para atualizá-la.' };
    }
    return this.financeService.updateIncome({
      id,
      amount: getNumber(payload, 'amount') ?? getNumber(payload, 'value'),
      description: getString(payload, 'description'),
      category: getString(payload, 'category'),
      date: getString(payload, 'date'),
    });
  }
}
