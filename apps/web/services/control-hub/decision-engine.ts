import type { DecisionEngine } from './control-hub.interfaces';
import type { HubMessage } from './control-hub.types';
import type { DecisionResult } from './decision-engine.types';
import type { UserContext } from '@/services/context-provider';

/**
 * Decision Engine — "ainda NÃO implementar IA. Criar apenas a estrutura...
 * nesta etapa utilizar mocks", exatamente como pedido. `MockDecisionEngine`
 * sempre decide `'reply'`, nunca propõe uma `ActionRequest` de verdade —
 * decisão determinística, sem heurística nenhuma, só para o pipeline do
 * CONTROL HUB ter uma implementação real de ponta a ponta para testar.
 *
 * Quando este componente ganhar inteligência de verdade (fase futura), é
 * aqui — não em `NovaGateway` nem em `ContextManager` — que a lógica de
 * "isso vira uma ação, isso só vira resposta, isso precisa de mais
 * informação do usuário" vai morar.
 */
export class MockDecisionEngine implements DecisionEngine {
  async decide(message: HubMessage, _context: UserContext): Promise<DecisionResult> {
    return {
      kind: 'reply',
      reply: `[Control Hub · mock] mensagem recebida do canal "${message.channel}": "${message.content}"`,
      actions: [],
    };
  }
}

export const decisionEngine: DecisionEngine = new MockDecisionEngine();
