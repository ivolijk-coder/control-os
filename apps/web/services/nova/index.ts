/**
 * Ponto único de importação da camada Nova (CONTROL OS 3.0). Consumidores
 * (NovaWorkspace, e futuramente o adapter de WhatsApp) importam só daqui.
 */
export { processNovaTurn } from './conversation';
export { buildDailyCheckIn, buildTodayHighlights } from './conversation/daily-checkin';
export { parseIntent } from './intent/parser';
export { TOOL_REGISTRY } from './tool-registry';
export { recallRecent } from './memory';
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
