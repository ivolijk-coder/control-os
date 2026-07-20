import type { FinanceRecurrenceFrequency } from '@control-os/types';
import type { FinanceService } from '@/services/modules';
import { financeService as defaultFinanceService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { ActionHandler } from '../../action.interfaces';
import { getNumber, getString } from '../../payload-guards';

function toFrequency(value: string | undefined): FinanceRecurrenceFrequency | undefined {
  return value === 'mensal' || value === 'semanal' || value === 'anual' ? value : undefined;
}

function toRecurringType(value: string | undefined): 'receita' | 'despesa' | undefined {
  return value === 'receita' || value === 'despesa' ? value : undefined;
}

/**
 * `recurring.create` — CONTROL OS Fase 7 (Financeiro completo). Registra
 * uma despesa/receita recorrente (mensal/semanal/anual) — "preparar
 * arquitetura para geração automática futura. Ainda não criar scheduler":
 * esta Action cria só a PRIMEIRA ocorrência, com a frequência marcada.
 */
export class CreateRecurringAction implements ActionHandler {
  readonly kind: ActionKind = 'recurring.create';

  readonly capability: Capability = {
    kind: 'recurring.create',
    description: 'Registra uma despesa ou receita recorrente do usuário (mensal, semanal ou anual). Cria só a primeira ocorrência.',
    parameters: [
      { name: 'value', type: 'number', required: true, description: 'Valor de cada ocorrência, em reais.' },
      { name: 'frequency', type: 'string', required: true, description: 'Frequência: "mensal", "semanal" ou "anual".' },
      { name: 'description', type: 'string', required: false, description: 'Descrição curta (ex.: "Aluguel", "Academia").' },
      { name: 'category', type: 'string', required: false, description: 'Categoria, se mencionada.' },
      { name: 'type', type: 'string', required: false, description: '"despesa" (padrão) ou "receita".' },
    ],
    examples: [
      'Pago 1500 de aluguel todo mês -> {"kind":"recurring.create","confidence":0.85,"parameters":{"value":1500,"frequency":"mensal","description":"Aluguel"}}',
    ],
  };

  constructor(private readonly financeService: FinanceService = defaultFinanceService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const amount = getNumber(payload, 'amount') ?? getNumber(payload, 'value');
    const frequency = toFrequency(getString(payload, 'frequency'));
    if (amount === undefined) {
      return { success: false, message: 'Não entendi o valor da recorrência — preciso de um "amount" (ou "value") numérico.' };
    }
    if (!frequency) {
      return { success: false, message: 'Preciso saber a frequência: "mensal", "semanal" ou "anual".' };
    }
    return this.financeService.createRecurring({
      type: toRecurringType(getString(payload, 'type')),
      amount,
      frequency,
      description: getString(payload, 'description'),
      category: getString(payload, 'category'),
      accountName: getString(payload, 'accountName'),
      date: getString(payload, 'date'),
    });
  }
}
