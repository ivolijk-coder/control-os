import type { NovaActionResult, NovaContext } from '@/services/nova';
import { postFinanceAction } from '../finance-bridge';
import type { Action } from './types';

export interface CreateInstallmentInput {
  totalAmount: number;
  installments: number;
  description: string;
}

/**
 * Comando "parcelar uma despesa" — resolvido pelo `IntentResolver` a partir
 * da intent `parcelar_despesa` (CONTROL OS — Fase 7: Financeiro completo).
 * Mesmo motivo de `CreateTransferAction`: NÃO escreve em `useDataStore` (só
 * `installmentGroupId`/`installmentNumber`/`installmentTotal` fariam
 * sentido nas páginas atuais se elas soubessem ler parcelamento — fora de
 * escopo nesta fase). Persiste só via `postFinanceAction`,
 * que executa `installment.create` no Action Engine
 * (`PersistentFinanceService.createInstallment` — N lançamentos ligados,
 * valor dividido em centavos inteiros, resto absorvido pela última parcela).
 */
export class CreateInstallmentAction implements Action {
  constructor(private readonly input: CreateInstallmentInput) {}

  async execute(_ctx: NovaContext): Promise<NovaActionResult[]> {
    const result = await postFinanceAction('installment.create', {
      totalAmount: this.input.totalAmount,
      installments: this.input.installments,
      description: this.input.description,
    });

    return [
      {
        action: { kind: 'criar_parcelamento', label: 'Parcelar despesa' },
        ok: result.success,
        detail: result.success ? `${this.input.description} em ${this.input.installments}x` : result.message,
      },
    ];
  }
}
