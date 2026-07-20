/**
 * Ponto único de importação do CONTROL HUB. Consumidores (os adapters em
 * `channels/*`, e futuramente Route Handlers de webhook) importam só
 * daqui — nunca de `control-hub.service.ts`, `context-manager.ts`,
 * `decision-engine.ts` ou `nova-gateway.ts` diretamente. Mesma convenção
 * de `services/nova/index.ts` e `services/ai/index.ts`.
 */
export { ControlHubService, controlHub } from './control-hub.service';
export { validateHubMessage } from './validate-message';
export { normalizeHubMessage } from './normalize-message';
export { ContextManagerImpl, contextManager } from './context-manager';
export { MockDecisionEngine, decisionEngine } from './decision-engine';
export { MockNovaGateway, novaGateway } from './nova-gateway';
export type {
  Attachment,
  HubChannel,
  HubMessage,
  HubMessageType,
  HubPipelineResult,
  HubValidationResult,
} from './control-hub.types';
export type {
  ActionEngine,
  ChannelAdapter,
  ContextManager,
  ControlHub,
  DecisionEngine,
  NovaGateway,
} from './control-hub.interfaces';
export type { ActionKind, ActionRequest, ActionResult } from './action-engine.types';
export type { DecisionKind, DecisionResult } from './decision-engine.types';
export type { NovaGatewayResult } from './nova-gateway.types';
/**
 * `UserContext` mora em `services/context-provider` (ver aquele módulo) —
 * reexportado aqui só por conveniência, porque faz parte da assinatura
 * pública de `ContextManager`/`DecisionEngine`/`NovaGateway` acima. Quem
 * precisa montar/consumir um `UserContext` de verdade (não só anotar um
 * tipo) importa de `@/services/context-provider` diretamente.
 */
export type { UserContext } from '@/services/context-provider';
