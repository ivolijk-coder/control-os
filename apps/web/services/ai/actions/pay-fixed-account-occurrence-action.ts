import type { NovaActionResult, NovaContext } from '@/services/nova';
import { postFinanceAction } from '../finance-bridge';
import type { Action } from './types';

export class PayFixedAccountOccurrenceAction implements Action {
  constructor(private readonly name: string) {}

  async execute(_ctx: NovaContext): Promise<NovaActionResult[]> {
    const result = await postFinanceAction('fixed-occurrence.pay', {
      name: this.name,
      idempotencyKey: globalThis.crypto?.randomUUID?.() ?? `nova-fixed-payment-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });
    return [{ action: { kind: 'pagar_conta_fixa', label: 'Pagar conta fixa' }, ok: result.success, detail: result.message }];
  }
}
