/**
 * Ponto único de importação do Action Engine (CONTROL HUB — Fase 4).
 * Consumidores (`control-hub.service.ts`, testes de integração) importam só
 * daqui — nunca de `action-registry.ts` ou de `actions/*` diretamente.
 * Mesma convenção de `services/control-hub/index.ts`,
 * `services/context-provider/index.ts`, `services/memory/index.ts` e
 * `services/modules/index.ts`.
 */
export { ActionRegistry, actionRegistry, DEFAULT_ACTION_HANDLERS } from './action-registry';
export type { ActionHandler } from './action.interfaces';
export { getBoolean, getNumber, getString } from './payload-guards';

export { CreateEventAction } from './actions/calendar/create-event.action';
export { UpdateEventAction } from './actions/calendar/update-event.action';
export { DeleteEventAction } from './actions/calendar/delete-event.action';
export { CreateExpenseAction } from './actions/finance/create-expense.action';
export { UpdateExpenseAction } from './actions/finance/update-expense.action';
export { DeleteExpenseAction } from './actions/finance/delete-expense.action';
export { CreateIncomeAction } from './actions/finance/create-income.action';
export { UpdateIncomeAction } from './actions/finance/update-income.action';
export { DeleteIncomeAction } from './actions/finance/delete-income.action';
export { CreateTaskAction } from './actions/tasks/create-task.action';
export { CreateNoteAction } from './actions/notes/create-note.action';
export { UpdateHabitAction } from './actions/habits/update-habit.action';
export { UpdateGoalAction } from './actions/goals/update-goal.action';
export { StoreDocumentAction } from './actions/documents/store-document.action';
