import type { ActionRequest } from './action-engine.types';

/**
 * O que o Decision Engine pode decidir fazer com uma mensagem:
 * - `reply`: só responder ao usuário, nenhuma ação de domínio.
 * - `execute_actions`: uma ou mais `ActionRequest` devem rodar (o próprio
 *   `DecisionResult.actions` carrega quais).
 * - `ask_clarification`: a mensagem é ambígua demais para decidir sozinho.
 * - `noop`: nada a fazer (ex.: mensagem vazia após normalização, evento
 *   informativo sem ação associada).
 */
export type DecisionKind = 'reply' | 'execute_actions' | 'ask_clarification' | 'noop';

/** Saída do Decision Engine — ver `decision-engine.ts` para a implementação mock desta fase. */
export interface DecisionResult {
  kind: DecisionKind;
  /** Texto sugerido de resposta — presente em `reply` e `ask_clarification`, ausente em `execute_actions` puro e `noop`. */
  reply?: string;
  /** Sempre presente (pode ser vazio) — nunca `undefined`, para o `ControlHubService` poder chamar `.length`/iterar sem checagem extra. */
  actions: ActionRequest[];
}
