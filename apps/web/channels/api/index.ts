import type { ChannelAdapter } from '@/services/control-hub';

/**
 * Adapter reservado para a "API pública" do CONTROL OS — CONTROL HUB.
 *
 * Nenhuma rota pública existe ainda (fora do escopo desta fase — ver
 * "Ainda NÃO implementar: Webhooks"). Quando existir (ex.: uma Route
 * Handler tipo `app/api/public/v1/messages/route.ts`, autenticada por
 * API key), a implementação real deste adapter recebe o corpo JSON da
 * requisição, converte para `HubMessage` e chama `controlHub.receive` —
 * a Route Handler em si fica fina (só parsing HTTP + chamada ao adapter),
 * igual descrito em `control-hub.service.ts` sobre a ausência de um
 * "controller" nesta arquitetura.
 */

/** Placeholder — o formato real do corpo da requisição pública será definido junto do endpoint. */
export type ApiRawRequestBody = unknown;

export interface ApiChannelAdapter extends ChannelAdapter<ApiRawRequestBody> {
  readonly channel: 'api';
}
