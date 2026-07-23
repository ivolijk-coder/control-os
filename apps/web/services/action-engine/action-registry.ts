import type { ActionEngine, ActionKind, ActionRequest } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { ActionHandler } from './action.interfaces';
import { CreateEventAction } from './actions/calendar/create-event.action';
import { UpdateEventAction } from './actions/calendar/update-event.action';
import { DeleteEventAction } from './actions/calendar/delete-event.action';
import { CreateExpenseAction } from './actions/finance/create-expense.action';
import { UpdateExpenseAction } from './actions/finance/update-expense.action';
import { DeleteExpenseAction } from './actions/finance/delete-expense.action';
import { CreateIncomeAction } from './actions/finance/create-income.action';
import { UpdateIncomeAction } from './actions/finance/update-income.action';
import { DeleteIncomeAction } from './actions/finance/delete-income.action';
import { CreateTransferAction } from './actions/finance/create-transfer.action';
import { CreateInstallmentAction } from './actions/finance/create-installment.action';
import { CreateRecurringAction } from './actions/finance/create-recurring.action';
import { CreateAccountAction } from './actions/finance/create-account.action';
import { CreateCategoryAction } from './actions/finance/create-category.action';
import { CreateTaskAction } from './actions/tasks/create-task.action';
import { CreateNoteAction } from './actions/notes/create-note.action';
import { UpdateHabitAction } from './actions/habits/update-habit.action';
import { UpdateGoalAction } from './actions/goals/update-goal.action';
import { StoreDocumentAction } from './actions/documents/store-document.action';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';

/**
 * Handlers desta fase — as 11 ações do catálogo (`ActionKind`,
 * `services/control-hub/action-engine.types.ts`). Cada um já vem com seu
 * Module Service default injetado (ver cada `*.action.ts`); passar outra
 * lista no construtor de `ActionRegistry` (ex.: em teste) troca só os
 * handlers que fizerem sentido, sem precisar reconstruir os outros.
 *
 * Exportado (não mais privado) desde a Fase 5 (Decision Engine com IA):
 * `services/decision-engine/capability-registry.ts` usa esta MESMA lista
 * pra montar o catálogo de Capabilities que vai pro prompt do modelo —
 * "evitar duplicação de informações" entre "o que o Action Engine executa" e
 * "o que o Decision Engine anuncia pro modelo" só é garantido de verdade se
 * os dois lerem do mesmo array. Renomeado de `DEFAULT_HANDLERS` pra deixar
 * explícito, agora que é um export público, que é "handlers padrão de
 * Action" — não confundir com nenhum outro "default" do módulo.
 */
export const DEFAULT_ACTION_HANDLERS: ActionHandler[] = [
  new CreateEventAction(),
  new UpdateEventAction(),
  new DeleteEventAction(),
  new CreateExpenseAction(),
  new UpdateExpenseAction(),
  new DeleteExpenseAction(),
  new CreateIncomeAction(),
  new UpdateIncomeAction(),
  new DeleteIncomeAction(),
  new CreateTransferAction(),
  new CreateInstallmentAction(),
  new CreateRecurringAction(),
  new CreateAccountAction(),
  new CreateCategoryAction(),
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

  constructor(handlers: ActionHandler[] = DEFAULT_ACTION_HANDLERS) {
    this.handlers = new Map(handlers.map((handler) => [handler.kind, handler]));
  }

  async execute(actions: ActionRequest[], actorUserId?: string): Promise<ActionResult[]> {
    const execute = () => Promise.all(actions.map((request) => this.executeOne(request)));
    return actorUserId ? runAsFinanceUser(actorUserId, execute) : execute();
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
