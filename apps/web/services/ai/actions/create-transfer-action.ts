import type { NovaActionResult, NovaContext } from '@/services/nova';
import { postFinanceAction } from '../finance-bridge';
import type { Action } from './types';

export interface CreateTransferInput {
  amount: number;
  toAccountName: string;
  fromAccountName?: string;
}

/**
 * Comando "transferir entre contas" — resolvido pelo `IntentResolver` a
 * partir da intent `transferir_conta` (CONTROL OS — Fase 7: Financeiro
 * completo). Diferente de `CreateExpenseAction`/`CreateIncomeAction`, NÃO
 * escreve em `useDataStore` — as páginas que leem `financeEntries`
 * (`dashboard/page.tsx`, `financeiro/page.tsx`) usam um ternário
 * `entry.type === 'receita' ? amount : -amount` que trataria um lançamento
 * `'transferencia'` como despesa (contagem dobrada incorreta); corrigir
 * isso está fora do escopo desta fase ("ainda não implementar Dashboard
 * Web"). Em vez disso, persiste só via `postFinanceAction` (fire-and-forget
 * — ver `services/ai/finance-bridge.ts`), que executa `transfer.create` no
 * MESMO Action Engine do CONTROL HUB (`PersistentFinanceService.createTransfer`).
 */
export class CreateTransferAction implements Action {
  constructor(private readonly input: CreateTransferInput) {}

  execute(_ctx: NovaContext): NovaActionResult[] {
    postFinanceAction('transfer.create', {
      amount: this.input.amount,
      toAccountName: this.input.toAccountName,
      fromAccountName: this.input.fromAccountName,
    });

    return [
      {
        action: { kind: 'criar_transferencia', label: 'Transferir entre contas' },
        ok: true,
        detail: `R$ ${this.input.amount.toFixed(2)} para ${this.input.toAccountName}`,
      },
    ];
  }
}
