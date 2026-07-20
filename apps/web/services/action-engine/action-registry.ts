import type { ActionEngine, ActionKind, ActionRequest } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { ActionHandler } from './action.interfaces';
import { CreateEventAction } from './actions/calendar/create-event.action';
import { UpdateEventAction } from './actions/calendar/update-event.action';
import { DeleteEventAction } from './actions/calendar/delete-event.action';
import { CreateExpenseAction } from './actions/finance/create-expense.action';
import { UpdateExpenseAction } from './actions/finance/update-expense.action';
import { DeleteExpenseAction } from './actions/finance/delete-expense.action';
import { CreateTaskAction } from './actions/tasks/create-task.action';
import { CreateNoteAction } from './actions/notes/create-note.action';
import { UpdateHabitAction } from './actions/habits/update-habit.action';
import { UpdateGoalAction } from './actions/goals/update-goal.action';
import { StoreDocumentAction } from './actions/documents/store-document.action';

/**
 * Handlers desta fase — as 11 ações do catálogo (`ActionKind`,
 * `services/control-hub/action-engine.types.ts`). Cada um já vem com seu
 * Module Service default injetado (ver cada `*.action.ts`); passar outra
 * lista no construtor de `ActionRegistry` (ex.: em teste) troca só os
 * handlers que fizerem sentido, sem precisar reconstruir os outros.
 */
const DEFAULT_HANDLERS: ActionHandler[] = [
  new CreateEventAction(),
  new UpdateEventAction(),
  new DeleteEventAction(),
  new CreateExpenseAction(),
  new UpdateExpenseAction(),
  new DeleteExpenseAction(),
  new CreateTaskAction(),
  new CreateNoteAction(),
  new UpdateHabitAction(),
  new UpdateGoalAction(),
  new StoreDocumentAction(),
];

/**
 * Action Registry (CONTROL HUB — Fase 4) — "o Registry localiza
 * automaticamente o executor correto. A NOVA nunca conhece
 * implementações." `ActionRegistry` implementa a interface `ActionEngine`
 * que já existia desde a Fase 1 (`services/control-hub/control-hub.
 * interfaces.ts`) — esta é a primeira implementação REAL dela;
 * `ControlHubService` (Fase 1) já sabia chamar `actionEngine.execute(...)`,
 * só não tinha nada de verdade para injetar.
 *
 * `execute(actions)` roda cada `ActionRequest` em paralelo (`Promise.all`) e
 * devolve os resultados na MESMA ordem de `actions` — a correlação
 * pedido↔resultado é posicional (ver doc de `ActionResult` em
 * `action-result.types.ts` para o porquê disso ser suficiente).
 */
export class ActionRegistry implements ActionEngine {
  private readonly handlers: Map<ActionKind, ActionHandler>;

  constructor(handlers: ActionHandler[] = DEFAULT_HANDLERS) {
    this.handlers = new Map(handlers.map((handler) => [handler.kind, handler]));
  }

  async execute(actions: ActionRequest[]): Promise<ActionResult[]> {
    return Promise.all(actions.map((request) => this.executeOne(request)));
  }

  private async executeOne(request: ActionRequest): Promise<ActionResult> {
    const handler = this.handlers.get(request.kind);
    if (!handler) {
      // Nunca alcançado com o `MockDecisionEngine` desta fase (só produz
      // `ActionKind` que têm handler registrado) — rede de segurança para
      // quando um Decision Engine futuro propuser um `ActionKind` sem
      // executor ainda implementado.
      return { success: false, message: `Nenhum executor registrado para a ação "${request.kind}".` };
    }
    return handler.execute(request.payload);
  }
}

export const actionRegistry: ActionEngine = new ActionRegistry();
