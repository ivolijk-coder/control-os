import type { NovaGateway } from './control-hub.interfaces';
import type { HubContext, HubMessage } from './control-hub.types';
import type { NovaGatewayResult } from './nova-gateway.types';

/**
 * Nova Gateway — a ponte formal entre o CONTROL HUB e a NOVA
 * (`services/nova` + `services/ai`, hoje acessada via
 * `ConversationService.processTurn`). Não estava no pedido original como
 * um componente próprio (o diagrama trata "Send to NOVA" como uma seta,
 * não uma caixa) — foi extraído para uma interface dedicada por dois
 * motivos:
 *
 * 1. Sem isso, `ControlHubService` precisaria importar `ConversationService`
 *    diretamente, o que reintroduziria acoplamento forte entre o Hub e a
 *    implementação concreta da NOVA — exatamente o tipo de acoplamento que
 *    esta arquitetura existe para eliminar nos CANAIS; não faz sentido
 *    deixá-lo entrar pela porta dos fundos dentro do próprio Hub.
 * 2. `ConversationService.processTurn` exige um `NovaContext` REAL — e
 *    `NovaContext.actions` são funções vinculadas a uma instância viva de
 *    `useDataStore` (Zustand, só existe no navegador, dentro de uma árvore
 *    React). Um canal server-side (WhatsApp, API pública) não tem como
 *    montar isso hoje — não existe fonte de dados persistente/compartilhada
 *    por trás do Hub ainda (ver `context-manager.ts`). Então, mesmo se o
 *    Hub chamasse `ConversationService` diretamente, só funcionaria para o
 *    canal `web` — uma mentira arquitetural para os outros três.
 *
 * `MockNovaGateway` documenta essa lacuna sendo honesto sobre ela, em vez
 * de fingir uma integração que só funcionaria parcialmente. Quando o canal
 * `web` for de fato migrado para passar pelo Hub (fora do escopo desta
 * fase — ver `channels/web`), a implementação real deste gateway é o lugar
 * certo para popular `NovaContext` a partir do `HubContext` e chamar
 * `conversationService.processTurn`.
 */
export class MockNovaGateway implements NovaGateway {
  async send(message: HubMessage, _context: HubContext): Promise<NovaGatewayResult> {
    return {
      reply: `[NOVA · mock via Control Hub] ainda não conectada — mensagem recebida: "${message.content}"`,
      handled: false,
    };
  }
}

export const novaGateway: NovaGateway = new MockNovaGateway();
