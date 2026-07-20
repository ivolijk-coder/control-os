import type { FinanceAccountKind } from '@control-os/types';
import type { FinanceService } from '@/services/modules';
import { financeService as defaultFinanceService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { ActionHandler } from '../../action.interfaces';
import { getString } from '../../payload-guards';

const VALID_KINDS: readonly FinanceAccountKind[] = ['carteira', 'conta_corrente', 'poupanca', 'cartao_credito', 'outro'];

function toAccountKind(value: string | undefined): FinanceAccountKind | undefined {
  return VALID_KINDS.find((candidate) => candidate === value);
}

/**
 * `account.create` — CONTROL OS Fase 7 (Financeiro completo). "Criar
 * suporte para múltiplas contas... Carteira, Conta Corrente, Poupança,
 * Nubank, Inter, Caixa, Cartão de Crédito." Na prática, a maioria das
 * contas nasce implicitamente (get-or-create por nome, ver
 * `FinanceService.resolveAccountId`) na primeira despesa/receita/transferência
 * que a menciona — esta Action existe para o caso explícito ("cria uma
 * conta chamada Inter").
 */
export class CreateAccountAction implements ActionHandler {
  readonly kind: ActionKind = 'account.create';

  readonly capability: Capability = {
    kind: 'account.create',
    description: 'Cria uma nova conta financeira do usuário (ex.: um banco ou carteira).',
    parameters: [
      { name: 'name', type: 'string', required: true, description: 'Nome da conta (ex.: "Nubank", "Carteira").' },
      {
        name: 'kind',
        type: 'string',
        required: false,
        description: 'Classificação: "carteira", "conta_corrente", "poupanca", "cartao_credito" ou "outro". Se não mencionada, usa "outro".',
      },
    ],
    examples: ['Cria uma conta chamada Inter -> {"kind":"account.create","confidence":0.8,"parameters":{"name":"Inter"}}'],
  };

  constructor(private readonly financeService: FinanceService = defaultFinanceService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const name = getString(payload, 'name');
    if (!name) {
      return { success: false, message: 'Preciso de um "name" para criar a conta.' };
    }
    return this.financeService.createAccount({ name, kind: toAccountKind(getString(payload, 'kind')) });
  }
}
