import type { HubMessage } from './control-hub.types';

/**
 * Etapa "Normalize" do pipeline do CONTROL HUB — única responsabilidade:
 * levar uma `HubMessage` já validada para uma forma canônica e previsível,
 * para que Context Manager, NOVA, Decision Engine e Action Engine nunca
 * precisem lidar com variações de formatação entre canais (espaços
 * sobrando, `attachments`/`metadata` ausentes vs. vazios, etc.).
 *
 * Retorna uma `HubMessage` NOVA (não muta a recebida) — mesmo princípio
 * de imutabilidade já usado no resto do CONTROL OS (`useDataStore`,
 * `services/nova`).
 */
export function normalizeHubMessage(message: HubMessage): HubMessage {
  return {
    ...message,
    content: message.content.trim(),
    attachments: message.attachments ?? [],
    metadata: message.metadata ?? {},
  };
}
