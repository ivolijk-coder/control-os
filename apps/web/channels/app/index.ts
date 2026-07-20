import type { ChannelAdapter } from '@/services/control-hub';

/**
 * Adapter reservado para o canal "aplicativo" (app mobile nativo) —
 * CONTROL HUB.
 *
 * Ainda não existe um app mobile neste monorepo (nenhum `apps/mobile` ou
 * equivalente) — esta pasta só reserva o lugar e o contrato
 * (`ChannelAdapter`) que o adapter real deverá implementar assim que o
 * app existir: receber o payload nativo do app (`AppRawEvent`, a definir
 * junto com o próprio app) e convertê-lo para `HubMessage` antes de
 * chamar `controlHub.receive`. Nenhuma lógica real aqui ainda — mesmo
 * princípio de `channels/web` e `channels/api`.
 */

/** Placeholder — substituído pelo formato real do evento do app quando ele existir. */
export type AppRawEvent = unknown;

export interface AppChannelAdapter extends ChannelAdapter<AppRawEvent> {
  readonly channel: 'app';
}
