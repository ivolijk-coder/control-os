import type { FinanceService } from '@/services/modules';
import { financeService as defaultFinanceService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { ActionHandler } from '../../action.interfaces';
import { getNumber, getString } from '../../payload-guards';

/**
 * `income.create` — CONTROL OS Fase 6 (Persistência real): "Implementar
 * Receitas... createIncome()." Espelha `CreateExpenseAction` campo a
 * campo — mesma entidade (`Transaction`/`FinanceEntry`), só `type` muda.
 */
export class CreateIncomeAction implements ActionHandler {
  readonly kind: ActionKind = 'income.create';

  readonly capability: Capability = {
    kind: 'income.create',
    description: 'Registra uma nova receita (dinheiro que entrou) do usuário.',
    parameters: [
      { name: 'value', type: 'number', required: true, description: 'Valor da receita, em reais.' },
      { name: 'description', type: 'string', required: false, description: 'Descrição curta da receita.' },
      { name: 'category', type: 'string', required: false, description: 'Categoria da receita (ex.: Salário, Freelance).' },
      { name: 'categoryId', type: 'string', required: false, description: 'ID da categoria. Quando ausente, usa a categoria padrão Salário.' },
      { name: 'date', type: 'string', required: false, description: 'Data da receita (AAAA-MM-DD), se mencionada.' },
    ],
    examples: [
      'Recebi R$ 3000 de salário -> {"kind":"income.create","confidence":0.95,"parameters":{"value":3000,"category":"Salário"}}',
    ],
  };

  constructor(private readonly financeService: FinanceService = defaultFinanceService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const amount = getNumber(payload, 'amount') ?? getNumber(payload, 'value');
    if (amount === undefined) {
      return { success: false, message: 'Não entendi o valor da receita — preciso de um "amount" (ou "value") numérico.' };
    }
    return this.financeService.createIncome({
      amount,
      description: getString(payload, 'description'),
      categoryId: getString(payload, 'categoryId') ?? 'default:Salário',
      date: getString(payload, 'date'),
      source: financeSource(payload),
      idempotencyKey: getString(payload, 'idempotencyKey'),
    });
  }
}

function financeSource(payload: Record<string, unknown>): 'manual' | 'nova' | 'whatsapp' | 'api' {
  const value = getString(payload, 'source');
  return value === 'nova' || value === 'whatsapp' || value === 'api' ? value : 'manual';
}
