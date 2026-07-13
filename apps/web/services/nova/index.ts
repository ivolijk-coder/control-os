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
 *
 * Etapa 7 — IA-Native (inteligência contínua): o `import './observer'`
 * abaixo é de efeito colateral — não exporta nada, só garante que o
 * `NovaObserver` já esteja assinando o Event Bus assim que qualquer
 * consumidor carregar `services/nova` (todo `ConversationService` carrega).
 * `ConversationService` (`services/ai/conversation`, o único choke point de
 * escrita — ver `executeAndNarrate`) publica um `NovaEvent` depois de cada
 * execução bem-sucedida; o Observer escuta, gera recomendações
 * (`generateRecommendations`) e atualiza o NOVA State (`getNovaState`) —
 * tudo isso acontece independente de o usuário estar conversando ou não
 * neste exato momento, desde que alguma Action tenha rodado.
 */
import './observer';

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
export { publish, subscribe, subscribeAll, eventTypeForIntentKind } from './events';
export type { NovaEvent, NovaEventType } from './events';
export { getNovaState, updateNovaState } from './state';
export type { NovaStateSnapshot } from './state';
export { generateRecommendations, buildQuickAnalysis } from './recommendations';
export type { NovaRecommendation, NovaRecommendationCategory } from './recommendations';
export { buildHomeInsights } from './insights';
export type {
  NovaAction,
  NovaActionKind,
  NovaActionResult,
  NovaContext,
  NovaDataActions,
  NovaIntent,
  NovaIntentKind,
  NovaReadOnlyContext,
  NovaStatus,
  NovaTurnResult,
} from './interfaces';
export { toReadOnlyContext } from './interfaces';
