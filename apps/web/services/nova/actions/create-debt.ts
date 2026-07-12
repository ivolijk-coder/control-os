import type { DebtIntent, NovaActionResult, NovaContext } from '../interfaces';

const DEFAULT_CATEGORY = 'Outros';

/**
 * "Tenho uma dívida de R$ 3.000 em 10x" → Dívida → Atualizar Histórico →
 * Responder. Diferente de `createExpense`, não mexe em `financeEntries`
 * (uma dívida não é um lançamento pontual) — vive em `debts`, com saldo
 * próprio que diminui a cada parcela paga (ver `payDebtInstallment`).
 */
export function createDebt(ctx: NovaContext, intent: DebtIntent): NovaActionResult[] {
  const debt = ctx.actions.addDebt({
    description: intent.description,
    totalAmount: intent.totalAmount,
    remainingAmount: intent.totalAmount,
    installmentsTotal: intent.installments,
    installmentsPaid: 0,
    category: DEFAULT_CATEGORY,
    spaceId: ctx.defaultSpaceId,
  });

  const timelineEvent = ctx.actions.addTimelineEvent({
    type: 'financeiro',
    title: `Dívida registrada: ${debt.description}`,
    description: `R$ ${debt.totalAmount.toFixed(2)} em ${debt.installmentsTotal}x`,
    timestamp: new Date().toISOString(),
    spaceId: debt.spaceId,
    actor: 'nova',
  });

  return [
    { action: { kind: 'criar_divida', label: 'Registrar dívida' }, ok: true, detail: debt.description },
    { action: { kind: 'registrar_timeline', label: 'Atualizar histórico' }, ok: true, detail: timelineEvent.title },
  ];
}
