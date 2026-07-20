import { DEFAULT_ACTION_HANDLERS } from '@/services/action-engine';
import type { ActionHandler } from '@/services/action-engine';
import type { Capability } from '@/services/capability.types';

/**
 * Capability Registry (CONTROL HUB — Fase 5). "Uma nova camada responsável
 * por informar ao modelo quais capacidades o sistema possui... A IA nunca
 * deverá inventar Actions. Ela deverá escolher apenas Actions registradas."
 *
 * "Evitar duplicação de informações": em vez de manter uma lista própria de
 * Capabilities (que poderia divergir do que o Action Engine realmente
 * executa), este registry lê a MESMA lista de handlers que
 * `ActionRegistry` usa para executar (`DEFAULT_ACTION_HANDLERS`,
 * `services/action-engine/action-registry.ts`) — cada `ActionHandler` já
 * carrega sua própria `capability` (ver `action.interfaces.ts`). Impossível
 * o catálogo de Capabilities anunciado ao modelo divergir do catálogo de
 * Actions de fato executável, porque são o mesmo array.
 */
export interface CapabilityRegistry {
  /** Todas as Capabilities disponíveis — usado pelo Prompt Builder para descrever o sistema ao modelo. */
  list(): Capability[];
  /** Busca uma Capability por `kind` bruto (string, ainda não validada como `ActionKind`) — usado pela validação da resposta do modelo. `undefined` se não registrada. */
  find(kind: string): Capability | undefined;
}

export class ActionCapabilityRegistry implements CapabilityRegistry {
  constructor(private readonly handlers: ActionHandler[] = DEFAULT_ACTION_HANDLERS) {}

  list(): Capability[] {
    return this.handlers.map((handler) => handler.capability);
  }

  find(kind: string): Capability | undefined {
    return this.handlers.find((handler) => handler.kind === kind)?.capability;
  }
}

/** Instância padrão — mesma convenção de composition root já usada em todo o CONTROL HUB (`actionRegistry`, `memoryService`, `contextManager`...). */
export const capabilityRegistry: CapabilityRegistry = new ActionCapabilityRegistry();
