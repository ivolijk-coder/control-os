import type { FinanceService } from '@/services/modules';
import { financeService as defaultFinanceService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { ActionHandler } from '../../action.interfaces';
import { getNumber, getString } from '../../payload-guards';

/**
 * `transfer.create` — CONTROL OS Fase 7 (Financeiro completo).
 * "Transferi R$ 1.000 para o Nubank" → `transfer.create` →
 * `FinanceService.createTransfer()`. `fromAccountName` é opcional de
 * propósito — a conversa raramente diz a conta de origem ("transferi PARA
 * o Nubank" não menciona de onde saiu); `FinanceService` só pode inferir
 * a origem quando existe exatamente uma conta ativa. Não há conta padrão
 * criada ou escolhida implicitamente.
 */
export class CreateTransferAction implements ActionHandler {
  readonly kind: ActionKind = 'transfer.create';

  readonly capability: Capability = {
    kind: 'transfer.create',
    description: 'Transfere dinheiro de uma conta para outra do usuário. Não altera o patrimônio total, só move entre contas.',
    parameters: [
      { name: 'value', type: 'number', required: true, description: 'Valor transferido, em reais.' },
      { name: 'toAccountName', type: 'string', required: true, description: 'Nome da conta de destino (ex.: "Nubank", "Poupança").' },
      { name: 'fromAccountName', type: 'string', required: false, description: 'Nome da conta de origem, se mencionada. Se ausente, só pode ser inferida quando o usuário tem uma única conta ativa.' },
      { name: 'description', type: 'string', required: false, description: 'Descrição curta da transferência.' },
      { name: 'date', type: 'string', required: false, description: 'Data da transferência (AAAA-MM-DD), se mencionada.' },
    ],
    examples: [
      'Transferi 500 para o Nubank -> {"kind":"transfer.create","confidence":0.9,"parameters":{"value":500,"toAccountName":"Nubank"}}',
      'Passei 200 da conta corrente pra carteira -> {"kind":"transfer.create","confidence":0.85,"parameters":{"value":200,"fromAccountName":"Conta Corrente","toAccountName":"Carteira"}}',
    ],
  };

  constructor(private readonly financeService: FinanceService = defaultFinanceService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const amount = getNumber(payload, 'amount') ?? getNumber(payload, 'value');
    const toAccountName = getString(payload, 'toAccountName') ?? getString(payload, 'to');
    if (amount === undefined) {
      return { success: false, message: 'Não entendi o valor da transferência — preciso de um "amount" (ou "value") numérico.' };
    }
    if (!toAccountName) {
      return { success: false, message: 'Preciso saber para qual conta transferir ("toAccountName").' };
    }
    return this.financeService.createTransfer({
      amount,
      toAccountName,
      fromAccountName: getString(payload, 'fromAccountName') ?? getString(payload, 'from'),
      description: getString(payload, 'description'),
      date: getString(payload, 'date'),
    });
  }
}
