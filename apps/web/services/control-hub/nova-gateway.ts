import type { NovaGateway } from './control-hub.interfaces';
import type { HubMessage } from './control-hub.types';
import type { NovaGatewayResult } from './nova-gateway.types';
import type { UserContext } from '@/services/context-provider';

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
 * 2. `ConversationService.processTurn` ainda depende do navegador em DOIS
 *    pontos independentes — achado confirmado nesta fase (CONTROL HUB —
 *    Fase 2: "desacoplar completamente a NOVA do frontend"), não só o que
 *    já era conhecido desde a Fase 1:
 *    a. `NovaContext.actions` são funções vinculadas a uma instância viva
 *       de `useDataStore` (Zustand, só existe no navegador, dentro de uma
 *       árvore React) — resolvido do lado do CONTEXTO por `UserContext`
 *       (`services/context-provider`, 100% server-side), mas a capacidade
 *       de EXECUTAR ações continua presa ao Zustand até o Action Engine
 *       (`action-engine.types.ts`) ganhar implementação real.
 *    b. `ConversationService.processTurn` também chama `rememberTurn`/
 *       `recallFacts` (`services/nova/memory`) DIRETAMENTE, e essas funções
 *       leem/escrevem em `window.sessionStorage` — memória de conversa
 *       também é estado de navegador, não só o contexto de domínio.
 *       (`services/nova/memory` já se protege com `typeof window ===
 *       'undefined'` e não quebra rodando no servidor — mas perde memória
 *       silenciosamente, sem avisar ninguém.)
 *    Nenhum canal server-side (WhatsApp, API pública) tem como contornar
 *    (a) ou (b) hoje. Corrigir (a) é trabalho do Action Engine (fase
 *    futura); corrigir (b) exige um Memory Provider com a mesma inversão
 *    de dependência aplicada aqui ao Context Provider — fora do escopo
 *    desta fase ("refatore apenas o necessário"), mas é o próximo alvo
 *    natural de uma Fase 3.
 *
 * `MockNovaGateway` documenta essa lacuna sendo honesto sobre ela, em vez
 * de fingir uma integração que só funcionaria parcialmente. Quando o canal
 * `web` for de fato migrado para passar pelo Hub (fora do escopo desta
 * fase — ver `channels/web`), a implementação real deste gateway é o lugar
 * certo para popular `NovaContext` a partir do `UserContext` e chamar
 * `conversationService.processTurn` — mas só depois de (a) e (b) acima
 * também estarem resolvidos, ou o gateway real só funcionaria de verdade
 * para o canal `web`.
 */
export class MockNovaGateway implements NovaGateway {
  async send(message: HubMessage, _context: UserContext): Promise<NovaGatewayResult> {
    return {
      reply: `[NOVA · mock via Control Hub] ainda não conectada — mensagem recebida: "${message.content}"`,
      handled: false,
    };
  }
}

export const novaGateway: NovaGateway = new MockNovaGateway();
