import type { NovaActionResult, NovaContext } from '@/services/nova';
import { postFinanceAction } from '../finance-bridge';
import type { Action } from './types';

export class ListFixedAccountOccurrencesAction implements Action {
  constructor(private readonly period: 'amanha' | 'semana') {}

  async execute(_ctx: NovaContext): Promise<NovaActionResult[]> {
    const result = await postFinanceAction('fixed-occurrence.list_due', { period: this.period });
    return [{ action: { kind: 'consultar_contas_vencendo', label: 'Consultar contas a vencer' }, ok: result.success, detail: result.message }];
  }
}
