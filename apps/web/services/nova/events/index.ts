/**
 * Ponto único de importação do Event Bus (CONTROL OS — Etapa 7: IA-Native).
 * Só `services/ai/conversation/ConversationService.ts` publica (o único
 * choke point de escrita) e só `services/nova/observer` assina — nenhum
 * outro consumidor deveria precisar deste módulo hoje, mas ele é
 * intencionalmente exportado do barrel (`services/nova/index.ts`) porque um
 * futuro canal (WhatsApp, Scheduler) vai precisar assinar eventos também.
 */
export { publish, subscribe, subscribeAll } from './eventBus';
export { eventTypeForIntentKind } from './types';
export type { NovaEvent, NovaEventType } from './types';
