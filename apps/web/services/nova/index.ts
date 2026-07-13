/**
 * Ponto único de importação da camada Nova (CONTROL OS 3.0). Consumidores
 * (NovaWorkspace, e futuramente o adapter de WhatsApp) importam só daqui.
 *
 * NOVA CORE (CONTROL OS — Etapa 6: IA-Native) — este arquivo é a metade
 * "vocabulário de domínio" da NOVA CORE (a outra metade é
 * `services/ai/index.ts`): intents, planner, executor e memória de curto
 * prazo vivem aqui porque são o mesmo vocabulário usado tanto pelo
 * `MockAIProvider` (regex determinística) quanto pelo `OpenAIProvider`
 * (Tool Calling) — nenhum dos dois inventa um `NovaIntentKind` novo por
 * conta própria, os dois só produzem intenções deste catálogo, que
 * `ActionExecutor`/`IntentResolver` sabem executar. É por isso que "nenhum
 * módulo conversa com outro diretamente": a página de Metas, a de
 * Viagens, a de Financeiro etc. nunca chamam funções umas das outras —
 * todas leem/escrevem no `useDataStore`, e é só a NOVA CORE (este arquivo
 * + `services/ai`) que decide, a partir de uma frase do usuário, qual
 * combinação de ações desses domínios executar.
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
