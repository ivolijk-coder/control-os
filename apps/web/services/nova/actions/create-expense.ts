import type { ExpenseIntent, NovaActionResult, NovaContext } from '../interfaces';

const DEFAULT_CATEGORY = 'Outros';

/**
 * "Gastei R$ 35 no almoço" → Despesa → Categoria → Atualizar Financeiro →
 * Atualizar Dashboard → Atualizar Histórico → Responder.
 *
 * Dashboard e Financeiro leem o mesmo `useDataStore` — por isso um único
 * `addFinanceEntry` já cobre os dois; `addTimelineEvent` é o que alimenta
 * o Histórico (Timeline Inteligente).
 */
export function createExpense(ctx: NovaContext, intent: ExpenseIntent): NovaActionResult[] {
  const entry = ctx.actions.addFinanceEntry({
    type: 'despesa',
    description: intent.description,
    amount: intent.amount,
    category: DEFAULT_CATEGORY,
    date: new Date().toISOString(),
    spaceId: ctx.defaultSpaceId,
  });

  const timelineEvent = ctx.actions.addTimelineEvent({
    type: 'financeiro',
    title: `Despesa registrada: ${entry.description}`,
    description: `R$ ${entry.amount.toFixed(2)} · ${entry.category}`,
    timestamp: entry.date,
    spaceId: entry.spaceId,
    actor: 'nova',
  });

  return [
    { action: { kind: 'criar_despesa', label: 'Registrar despesa' }, ok: true, detail: entry.description },
    { action: { kind: 'registrar_timeline', label: 'Atualizar histórico' }, ok: true, detail: timelineEvent.title },
  ];
}
