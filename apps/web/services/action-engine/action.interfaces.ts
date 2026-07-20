import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';

/**
 * Contrato comum de toda Action (CONTROL HUB — Fase 4). "Cada Action
 * possuirá seu próprio executor" — cada implementação sabe UM `kind` e como
 * transformar o `payload` bruto (`ActionRequest.payload`,
 * `Record<string, unknown>` — nunca `any`) num efeito real contra o Module
 * Service correspondente.
 *
 * "Nenhuma Action conhece implementações concretas" — toda Action recebe o
 * Module Service que precisa via construtor, tipado pela INTERFACE do
 * Service (`FinanceService`, `CalendarService`...), nunca pela classe
 * `Mock*Service`.
 */
export interface ActionHandler {
  readonly kind: ActionKind;
  execute(payload: Record<string, unknown>): Promise<ActionResult>;
}
