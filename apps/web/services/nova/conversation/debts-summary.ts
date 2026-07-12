import type { Debt } from '@control-os/types';

/**
 * Formata valores em BRL localmente — `services/nova` não importa de
 * `apps/web/lib/utils` de propósito, para continuar portável para um
 * futuro canal fora do Next.js (ex.: WhatsApp), assim como `NovaDataActions`
 * já é o único ponto de contato com o resto do app.
 */
function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/**
 * Resposta de "quanto eu devo?" / "minhas dívidas" — lê `ctx.debts`
 * diretamente (intent de consulta, sem passar por `runIntent`/`buildReply`,
 * que assumem uma ação que muda dados).
 */
export function buildDebtsSummary(debts: Debt[]): string {
  const active = debts.filter((debt) => debt.remainingAmount > 0);

  if (active.length === 0) {
    return 'Você não tem nenhuma dívida em aberto registrada.';
  }

  const total = active.reduce((sum, debt) => sum + debt.remainingAmount, 0);
  const lines = active.map(
    (debt) =>
      `• ${debt.description}: ${formatBRL(debt.remainingAmount)} restante (${debt.installmentsPaid}/${debt.installmentsTotal} parcelas)`
  );

  return `Você tem ${active.length} dívida${active.length > 1 ? 's' : ''} em aberto, totalizando ${formatBRL(total)}:\n${lines.join('\n')}`;
}
