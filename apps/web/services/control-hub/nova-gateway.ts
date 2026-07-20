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
 * 2. `ConversationService.processTurn` dependia do navegador em DOIS pontos
 *    independentes — achado confirmado na Fase 2 (CONTROL HUB — "desacoplar
 *    completamente a NOVA do frontend"). Estado atual, depois da Fase 3:
 *    a. `NovaContext.actions` são funções vinculadas a uma instância viva
 *       de `useDataStore` (Zustand, só existe no navegador, dentro de uma
 *       árvore React) — resolvido do lado do CONTEXTO por `UserContext`
 *       (`services/context-provider`, 100% server-side), mas a capacidade
 *       de EXECUTAR ações continua presa ao Zustand até o Action Engine
 *       (`action-engine.types.ts`) ganhar implementação real. AINDA ABERTO.
 *    b. RESOLVIDO NA FASE 3 (Memory Layer). `ConversationService` não chama
 *       mais `rememberTurn`/`recallFacts` (`services/nova/memory`)
 *       diretamente — fala apenas com `memoryService` (`services/memory`),
 *       uma interface (`MemoryService`) que não conhece `window`/
 *       `sessionStorage`/`localStorage`. A única implementação que ainda
 *       toca Web Storage é `BrowserMemoryProvider`, injetada por baixo da
 *       interface — trocável, sem tocar `ConversationService`, por um
 *       provider real (Postgres/Redis/Supabase/API) quando essa fase
 *       chegar. Um canal server-side já poderia usar a memória da NOVA hoje
 *       (bastaria injetar um `MemoryProvider` server-side em `memoryService`
 *       — ainda não existe um, mas a interface já suporta).
 *    Nenhum canal server-side (WhatsApp, API pública) consegue contornar (a)
 *    hoje — isso é trabalho do Action Engine (fase futura). (b) não é mais
 *    um bloqueio.
 *
 * `MockNovaGateway` documenta essa lacuna sendo honesto sobre ela, em vez
 * de fingir uma integração que só funcionaria parcialmente. Quando o canal
 * `web` for de fato migrado para passar pelo Hub (fora do escopo desta
 * fase — ver `channels/web`), a implementação real deste gateway é o lugar
 * certo para popular `NovaContext` a partir do `UserContext` e chamar
 * `conversationService.processTurn` — mas só depois de (a) acima também
 * estar resolvido, ou o gateway real só funcionaria de verdade para o canal
 * `web`.
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
