import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { FinanceService } from '@/services/modules';
import { financeService as defaultFinanceService } from '@/services/modules';
import type { ActionHandler } from '../../action.interfaces';
import { getString } from '../../payload-guards';

export class PayFixedAccountOccurrenceAction implements ActionHandler {
  readonly kind: ActionKind = 'fixed-occurrence.pay';

  readonly capability: Capability = {
    kind: 'fixed-occurrence.pay',
    description: 'Baixa uma conta fixa pendente pelo seu nome, usando o núcleo financeiro oficial.',
    parameters: [{ name: 'name', type: 'string', required: true, description: 'Nome da conta fixa a pagar.' }],
    examples: ['Paguei a internet -> baixa a ocorrência pendente da Internet após confirmação.'],
  };

  constructor(private readonly financeService: FinanceService = defaultFinanceService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const name = getString(payload, 'name')?.trim();
    if (!name) return { success: false, message: 'Preciso do nome da conta que foi paga.' };

    const occurrences = await this.financeService.listFixedAccountOccurrences({ status: 'pendente' });
    const normalized = normalize(name);
    const matches = occurrences.filter((occurrence) => normalize(occurrence.name) === normalized);
    if (matches.length === 0) return { success: false, message: `Não encontrei uma conta pendente chamada "${name}".` };
    if (matches.length > 1) return { success: false, message: `Encontrei mais de uma conta pendente chamada "${name}". Escolha a ocorrência na tela Contas do Mês.` };

    const occurrence = matches[0];
    if (!occurrence) return { success: false, message: 'Não encontrei uma ocorrência disponível para baixa.' };
    return this.financeService.payFixedAccountOccurrence({
      id: occurrence.id,
      source: 'nova',
      idempotencyKey: getString(payload, 'idempotencyKey'),
    });
  }
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}
