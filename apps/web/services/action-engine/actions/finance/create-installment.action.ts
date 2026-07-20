import type { FinanceService } from '@/services/modules';
import { financeService as defaultFinanceService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { ActionHandler } from '../../action.interfaces';
import { getNumber, getString } from '../../payload-guards';

/** `'despesa'`/`'receita'` explícitos passam; qualquer outra coisa (incluindo ausente) cai no default de `FinanceService.createInstallment` ('despesa'). */
function toInstallmentType(value: string | undefined): 'receita' | 'despesa' | undefined {
  return value === 'receita' || value === 'despesa' ? value : undefined;
}

/**
 * `installment.create` — CONTROL OS Fase 7 (Financeiro completo). "Parcela
 * esse notebook em 12x" → `installment.create` →
 * `FinanceService.createInstallment()` → 12 lançamentos relacionados.
 */
export class CreateInstallmentAction implements ActionHandler {
  readonly kind: ActionKind = 'installment.create';

  readonly capability: Capability = {
    kind: 'installment.create',
    description: 'Registra uma despesa (ou receita) parcelada do usuário, gerando uma parcela por mês.',
    parameters: [
      { name: 'totalAmount', type: 'number', required: true, description: 'Valor total do parcelamento, em reais.' },
      { name: 'installments', type: 'number', required: true, description: 'Número de parcelas (ex.: 12 para "em 12x").' },
      { name: 'description', type: 'string', required: false, description: 'Descrição curta do parcelamento (ex.: "Notebook").' },
      { name: 'category', type: 'string', required: false, description: 'Categoria do parcelamento, se mencionada.' },
      { name: 'accountName', type: 'string', required: false, description: 'Conta/cartão usado, se mencionado. Se ausente, usa a conta padrão do usuário.' },
    ],
    examples: [
      'Parcela esse notebook em 12x -> {"kind":"installment.create","confidence":0.9,"parameters":{"totalAmount":3600,"installments":12,"description":"Notebook"}}',
    ],
  };

  constructor(private readonly financeService: FinanceService = defaultFinanceService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const totalAmount = getNumber(payload, 'totalAmount') ?? getNumber(payload, 'value');
    const installmentsRaw = getNumber(payload, 'installments');
    if (totalAmount === undefined) {
      return { success: false, message: 'Não entendi o valor total do parcelamento — preciso de um "totalAmount" numérico.' };
    }
    if (installmentsRaw === undefined) {
      return { success: false, message: 'Não entendi em quantas parcelas — preciso de um "installments" numérico.' };
    }
    return this.financeService.createInstallment({
      type: toInstallmentType(getString(payload, 'type')),
      totalAmount,
      installments: Math.round(installmentsRaw),
      description: getString(payload, 'description'),
      category: getString(payload, 'category'),
      accountName: getString(payload, 'accountName'),
      startDate: getString(payload, 'startDate') ?? getString(payload, 'date'),
    });
  }
}
