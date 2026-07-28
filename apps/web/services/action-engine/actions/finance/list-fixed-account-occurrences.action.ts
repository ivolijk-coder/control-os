import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { FinanceService } from '@/services/modules';
import { financeService as defaultFinanceService } from '@/services/modules';
import type { ActionHandler } from '../../action.interfaces';
import { getString } from '../../payload-guards';

export class ListFixedAccountOccurrencesAction implements ActionHandler {
  readonly kind: ActionKind = 'fixed-occurrence.list_due';

  readonly capability: Capability = {
    kind: 'fixed-occurrence.list_due',
    description: 'Consulta contas fixas pendentes que vencem amanhã ou nesta semana.',
    parameters: [{ name: 'period', type: 'string', required: true, description: '"amanha" ou "semana".' }],
    examples: ['Quais contas vencem amanhã?'],
  };

  constructor(private readonly financeService: FinanceService = defaultFinanceService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const period = getString(payload, 'period') === 'amanha' ? 'amanha' : 'semana';
    const today = startOfDay(new Date());
    const end = new Date(today);
    end.setDate(end.getDate() + (period === 'amanha' ? 1 : 7));
    const start = period === 'amanha' ? end : today;

    const occurrences = (await this.financeService.listFixedAccountOccurrences({ status: 'pendente' }))
      .filter((occurrence) => {
        const due = startOfDay(new Date(occurrence.dueDate));
        return due >= start && due <= end;
      });

    const label = period === 'amanha' ? 'amanhã' : 'esta semana';
    if (occurrences.length === 0) return { success: true, message: `Não há contas pendentes que vencem ${label}.`, data: [] };
    const summary = occurrences.map((occurrence) => `${occurrence.name} (${formatCurrency(occurrence.amount)})`).join(', ');
    return { success: true, message: `Para ${label}: ${summary}.`, data: occurrences };
  }
}

function startOfDay(date: Date): Date { date.setHours(0, 0, 0, 0); return date; }
function formatCurrency(value: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }
