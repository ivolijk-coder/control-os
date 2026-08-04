import type { ActionExecutionMetadata, ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';

/**
 * Contrato comum de toda Action (CONTROL HUB — Fase 4; `capability` chega na
 * Fase 5, Decision Engine com IA). "Cada Action possuirá seu próprio
 * executor" — cada implementação sabe UM `kind` e como transformar o
 * `payload` bruto (`ActionRequest.payload`, `Record<string, unknown>` —
 * nunca `any`) num efeito real contra o Module Service correspondente.
 *
 * "Nenhuma Action conhece implementações concretas" — toda Action recebe o
 * Module Service que precisa via construtor, tipado pela INTERFACE do
 * Service (`FinanceService`, `CalendarService`...), nunca pela classe
 * `Mock*Service`.
 *
 * `capability` — CONTROL HUB Fase 5: "Capability Registry... nome,
 * descrição, parâmetros esperados, exemplos de uso." Cada Action já nasce
 * com a descrição da SUA PRÓPRIA capability, em vez de um catálogo separado
 * mantido à mão em `services/decision-engine` — "evitar duplicação de
 * informações": a mesma lista de handlers (`DEFAULT_ACTION_HANDLERS`,
 * `action-registry.ts`) que o `ActionRegistry` usa pra executar é a que o
 * `CapabilityRegistry` usa pra descrever ao modelo; impossível divergir.
 */
export interface ActionHandler {
  readonly kind: ActionKind;
  readonly capability: Capability;
  execute(payload: Record<string, unknown>, metadata?: ActionExecutionMetadata): Promise<ActionResult>;
}
