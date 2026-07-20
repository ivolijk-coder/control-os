import type { ActionKind } from '@/services/control-hub';

/**
 * Bridge fino entre o chat real da NOVA (roda no navegador,
 * `ConversationService`/`ActionExecutor`) e a persistência de verdade do
 * Financeiro (`PersistentFinanceService` + Prisma, só roda no servidor) —
 * CONTROL OS Fase 7. Toda Action de Finance do chat real
 * (`services/ai/actions/create-expense-action.ts`,
 * `create-income-action.ts`, `create-transfer-action.ts`,
 * `create-installment-action.ts`) chama este helper para acionar
 * `app/api/finance/actions/route.ts`, que por sua vez delega pro MESMO
 * Action Engine (`services/action-engine`) que o CONTROL HUB já usa —
 * nenhuma lógica de negócio duplicada aqui, só uma chamada HTTP.
 *
 * Fire-and-forget deliberado: `Action.execute(ctx)`
 * (`services/ai/actions/types.ts`) é SÍNCRONO (retorna `NovaActionResult[]`,
 * não uma Promise) — não dá pra `await` esta chamada sem reescrever
 * `ActionExecutor`/`ConversationService` inteiros para assíncrono, o que é
 * desproporcional para esta fase (documentado no relatório da Fase 7). A UX
 * síncrona existente continua sendo a fonte de verdade IMEDIATA da resposta
 * ao usuário; esta chamada só garante que o mesmo lançamento também fique
 * persistido de verdade (Postgres via Prisma), em paralelo, sem bloquear a
 * resposta. Falhas são só logadas (`console.warn`) — sem retry nem fila
 * ainda (fora de escopo: "ainda não criar scheduler").
 */
const FINANCE_ACTIONS_ROUTE = '/api/finance/actions';

export function postFinanceAction(kind: ActionKind, payload: Record<string, unknown>): void {
  if (typeof fetch !== 'function') return; // Sem `fetch` global (ex.: SSR, testes) — não quebra o fluxo síncrono existente.
  fetch(FINANCE_ACTIONS_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, payload }),
  }).catch((error: unknown) => {
    console.warn(`[finance-bridge] Falha ao persistir "${kind}":`, error);
  });
}
