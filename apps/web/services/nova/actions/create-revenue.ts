import type { NovaActionResult, NovaContext, RevenueIntent } from '../interfaces';

const DEFAULT_CATEGORY = 'Receita';

/** "Recebi R$ 2.500" → Receita → Atualizar caixa → Atualizar indicadores. */
export function createRevenue(ctx: NovaContext, intent: RevenueIntent): NovaActionResult[] {
  const entry = ctx.actions.addFinanceEntry({
    type: 'receita',
    description: intent.description,
    amount: intent.amount,
    category: DEFAULT_CATEGORY,
    date: new Date().toISOString(),
    spaceId: ctx.defaultSpaceId,
  });

  const timelineEvent = ctx.actions.addTimelineEvent({
    type: 'financeiro',
    title: `Receita registrada: ${entry.description}`,
    description: `R$ ${entry.amount.toFixed(2)}`,
    timestamp: entry.date,
    spaceId: entry.spaceId,
    actor: 'nova',
  });

  return [
    { action: { kind: 'criar_receita', label: 'Registrar receita' }, ok: true, detail: entry.description },
    { action: { kind: 'registrar_timeline', label: 'Atualizar histórico' }, ok: true, detail: timelineEvent.title },
  ];
}
