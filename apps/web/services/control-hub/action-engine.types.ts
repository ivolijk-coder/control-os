/**
 * Vocabulário de ações que o Action Engine executará no futuro — exatamente
 * o catálogo listado no pedido original. Cada valor é `<domínio>.<verbo>`,
 * mesmo espírito do `NovaActionKind` já usado em `services/nova/interfaces`
 * (nunca duplicar: quando o Action Engine ganhar implementação real, esta
 * lista tende a convergir com as Actions que já existem em
 * `services/ai/actions/`, não a competir com elas).
 */
export type ActionKind =
  | 'calendar.create'
  | 'expense.create'
  | 'task.create'
  | 'note.create'
  | 'habit.update'
  | 'goal.update'
  | 'document.store';

/** Um pedido de execução — o Decision Engine produz uma lista destes, o Action Engine consome. */
export interface ActionRequest {
  kind: ActionKind;
  payload: Record<string, unknown>;
}

/** Resultado de uma `ActionRequest` já processada (com sucesso ou não). */
export interface ActionResult {
  request: ActionRequest;
  ok: boolean;
  detail?: string;
}
