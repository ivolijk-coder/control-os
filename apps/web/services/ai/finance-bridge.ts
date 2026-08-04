import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';

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
 * A ponte devolve o resultado real do servidor. A conversa da NOVA só
 * confirma sucesso depois que o núcleo financeiro persistiu a operação.
 */
const FINANCE_ACTIONS_ROUTE = '/api/finance/actions';

export async function postFinanceAction(
  kind: ActionKind,
  payload: Record<string, unknown>,
  metadata?: { operationId: string },
): Promise<ActionResult> {
  if (typeof fetch !== 'function') return { success: false, message: 'Não foi possível conectar a NOVA ao financeiro.' };
  try {
    const response = await fetch(FINANCE_ACTIONS_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, payload, origin: 'nova', operationId: metadata?.operationId }),
    });
    const result = await response.json().catch(() => undefined) as Partial<ActionResult> | undefined;
    if (!response.ok || !result?.success) {
      return { success: false, message: result?.message ?? 'Não foi possível concluir a operação financeira agora.', status: response.status };
    }
    return { success: true, message: result.message ?? 'Operação financeira concluída.', data: result.data };
  } catch (error) {
    console.warn(`[finance-bridge] Falha ao persistir "${kind}":`, error);
    return { success: false, message: 'Não foi possível conectar a NOVA ao financeiro.' };
  }
}
