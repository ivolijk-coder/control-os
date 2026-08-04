import type { NovaActionResult, NovaContext } from '@/services/nova';
import { postFinanceAction } from '../finance-bridge';
import type { Action } from './types';

export interface CreateFinancialContractActionInput {
  institution?: string;
  totalAmount: number;
  installments: number;
  installmentAmount?: number;
  dueDay: number;
  description: string;
}

abstract class CreateFinancialContractAction implements Action {
  protected abstract readonly actionKind: 'loan.create' | 'financing.create';
  protected abstract readonly resultKind: 'criar_emprestimo' | 'criar_financiamento';
  protected abstract readonly label: string;

  private readonly operationId = globalThis.crypto?.randomUUID?.()
    ?? `nova-contract-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  constructor(private readonly input: CreateFinancialContractActionInput) {}

  async execute(_ctx: NovaContext): Promise<NovaActionResult[]> {
    const result = await postFinanceAction(this.actionKind, { ...this.input }, { operationId: this.operationId });
    return [{
      action: { kind: this.resultKind, label: this.label },
      ok: result.success,
      detail: result.message,
    }];
  }
}

export class CreateLoanAction extends CreateFinancialContractAction {
  protected readonly actionKind = 'loan.create';
  protected readonly resultKind = 'criar_emprestimo';
  protected readonly label = 'Cadastrar empréstimo';
}

export class CreateFinancingAction extends CreateFinancialContractAction {
  protected readonly actionKind = 'financing.create';
  protected readonly resultKind = 'criar_financiamento';
  protected readonly label = 'Cadastrar financiamento';
}
