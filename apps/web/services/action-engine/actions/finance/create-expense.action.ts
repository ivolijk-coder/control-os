import type { FinanceService } from '@/services/modules';
import { financeService as defaultFinanceService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { ActionHandler } from '../../action.interfaces';
import { getNumber, getString } from '../../payload-guards';

/**
 * `expense.create` — "Gastei R$ 350 no supermercado" → `expense.create` →
 * `FinanceService.createExpense()` → resposta, exemplo literal do pedido
 * original.
 */
export class CreateExpenseAction implements ActionHandler {
  readonly kind: ActionKind = 'expense.create';

  /**
   * Nome canônico do parâmetro monetário é `value` — não `amount` — de
   * propósito: bate literalmente com o exemplo de saída do pedido original
   * da Fase 5 (`{"kind":"expense.create",...,"parameters":{"value":350,...}}`).
   * `execute` abaixo aceita os dois nomes (compatibilidade com o
   * `MockDecisionProvider`, que já produzia `amount` desde a Fase 4).
   */
  readonly capability: Capability = {
    kind: 'expense.create',
    description: 'Registra uma nova despesa (dinheiro que saiu) do usuário.',
    parameters: [
      { name: 'value', type: 'number', required: true, description: 'Valor da despesa, em reais.' },
      { name: 'description', type: 'string', required: false, description: 'Descrição curta da despesa.' },
      { name: 'category', type: 'string', required: false, description: 'Categoria da despesa (ex.: Mercado, Transporte).' },
      { name: 'categoryId', type: 'string', required: false, description: 'ID da categoria. Quando ausente, usa a categoria padrão Alimentação.' },
      { name: 'accountName', type: 'string', required: false, description: 'Nome da conta bancária informada pelo usuário.' },
      { name: 'date', type: 'string', required: false, description: 'Data da despesa (AAAA-MM-DD), se mencionada.' },
    ],
    examples: [
      'Gastei R$ 350 no mercado -> {"kind":"expense.create","confidence":0.98,"parameters":{"value":350,"category":"Supermercado"}}',
    ],
  };

  constructor(private readonly financeService: FinanceService = defaultFinanceService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const amount = getNumber(payload, 'amount') ?? getNumber(payload, 'value');
    if (amount === undefined) {
      return { success: false, message: 'Não entendi o valor da despesa — preciso de um "amount" (ou "value") numérico.' };
    }
    const category = getString(payload, 'category');
    return this.financeService.createExpense({
      amount,
      description: getString(payload, 'description'),
      accountName: getString(payload, 'accountName'),
      category,
      categoryId: getString(payload, 'categoryId') ?? (category ? undefined : 'default:Alimentação'),
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
