import type { ChannelAdapter } from '@/services/control-hub';

/**
 * Adapter reservado para o canal "web" (a própria interface do CONTROL
 * OS, `NovaWorkspace`) — CONTROL HUB.
 *
 * Diferente de `channels/app`/`channels/api` (canais que ainda não
 * existem de verdade), o canal web JÁ está em produção — hoje
 * `NovaWorkspace` chama `ConversationService.processTurn` diretamente
 * (via `services/nova`/`services/ai`), fora do CONTROL HUB. Migrar essa
 * chamada real para passar por `controlHub.receive` é uma mudança na UI
 * em produção, não "só infraestrutura nova" — deliberadamente FORA do
 * escopo desta fase ("quero apenas construir toda a infraestrutura
 * necessária").
 *
 * Quando essa migração acontecer, é aqui que o adapter vive: recebe o
 * texto digitado/falado no `NovaWorkspace` + o `NovaContext` real (já
 * montado a partir de `useDataStore`, único canal com acesso direto a ele
 * — ver a nota sobre isso em `services/control-hub/context-manager.ts`),
 * converte para `HubMessage` e chama `controlHub.receive`.
 */

/** Placeholder — o formato real de entrada do canal web (texto + NovaContext do useDataStore) será definido junto da migração. */
export type WebRawEvent = unknown;

export interface WebChannelAdapter extends ChannelAdapter<WebRawEvent> {
  readonly channel: 'web';
}
