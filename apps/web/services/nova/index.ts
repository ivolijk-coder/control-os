/**
 * Ponto único de importação da camada Nova (CONTROL OS 3.0). Consumidores
 * (NovaWorkspace, e futuramente o adapter de WhatsApp) importam só daqui.
 */
export { processNovaTurn, buildReply } from './conversation';
export { buildDailyCheckIn, buildTodayHighlights } from './conversation/daily-checkin';
export { buildDebtsSummary } from './conversation/debts-summary';
export { parseIntent, parseAmount, parseTime } from './intent/parser';
export { runIntent } from './executor';
export { buildPlan } from './planner';
export { TOOL_REGISTRY } from './tool-registry';
export { createExpense, createRevenue, createAgendaEvent, createGoal, createReminder } from './actions';
export { recallRecent, rememberTurn, rememberFact, recallFacts } from './memory';
export type { NovaFact, NovaFactCategory } from './memory';
export type {
  NovaAction,
  NovaActionKind,
  NovaActionResult,
  NovaContext,
  NovaDataActions,
  NovaIntent,
  NovaIntentKind,
  NovaStatus,
  NovaTurnResult,
} from './interfaces';
