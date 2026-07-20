/**
 * Módulo Financeiro (CONTROL HUB — Fase 4: Action Engine real). Cobre só
 * `expense.*` nesta fase — o catálogo de ações do pedido original não lista
 * `revenue.*`/`income.*`; quando um caso de uso real pedir, este módulo
 * ganha os métodos correspondentes, mesma forma.
 */

/** `amount`/`category`/`date` seguem o mesmo formato de `FinanceEntry` (`@control-os/types`) — nenhuma forma nova inventada. */
export interface CreateExpenseInput {
  amount: number;
  description?: string;
  category?: string;
  /** ISO (`YYYY-MM-DD` ou timestamp completo) — quando ausente, `MockFinanceService` usa o momento da chamada. */
  date?: string;
}

export interface UpdateExpenseInput {
  id: string;
  amount?: number;
  description?: string;
  category?: string;
  date?: string;
}

export interface DeleteExpenseInput {
  id: string;
}
