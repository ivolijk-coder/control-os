import { parseIntent } from '@/services/nova';
import type { NovaIntent } from '@/services/nova';
import type { DecisionEngine } from './control-hub.interfaces';
import type { HubMessage } from './control-hub.types';
import type { ActionRequest } from './action-engine.types';
import type { DecisionResult } from './decision-engine.types';
import type { UserContext } from '@/services/context-provider';

/**
 * Confiança atribuída quando o parser determinístico (`parseIntent`)
 * reconhece uma intent com todos os campos obrigatórios presentes — mock,
 * não uma probabilidade real (não há modelo nenhum aqui ainda). Existe só
 * para o campo `confidence` (`ActionRequest`) circular pelo pipeline de
 * ponta a ponta nesta fase; um Decision Engine real (IA) vai substituir
 * este valor fixo pela confiança de verdade do modelo.
 */
const DETERMINISTIC_MATCH_CONFIDENCE = 0.92;

/**
 * Traduz uma `NovaIntent` (vocabulário de domínio já usado por
 * `services/nova`/`services/ai`) para uma `ActionRequest` (vocabulário do
 * Action Engine, `services/control-hub/action-engine.types.ts`) — só para
 * as intents que já têm uma Action real implementada nesta fase
 * (`services/action-engine/actions/`). "Não criar abstrações
 * desnecessárias": as demais intents (`registrar_receita`,
 * `criar_objetivo`, `criar_projeto`, `registrar_divida`, `criar_habito`,
 * `criar_viagem`, `criar_bem`, as duas de consulta e `desconhecido`)
 * continuam respondendo via `kind: 'reply'`, como antes — o catálogo de
 * `ActionKind` desta fase não cobre `income.*`/`goal.create`/`asset.*`/
 * `trip.*`, então não há Action real para essas ainda.
 */
function toActionRequest(intent: NovaIntent): ActionRequest | undefined {
  switch (intent.kind) {
    case 'registrar_despesa':
      return {
        kind: 'expense.create',
        payload: { amount: intent.amount, description: intent.description },
        confidence: DETERMINISTIC_MATCH_CONFIDENCE,
      };
    case 'criar_agenda':
      return {
        kind: 'calendar.create',
        payload: { title: intent.title, date: intent.date, time: intent.time },
        confidence: DETERMINISTIC_MATCH_CONFIDENCE,
      };
    case 'criar_lembrete':
      return {
        kind: 'task.create',
        payload: { title: intent.title, dueDate: intent.dueDate },
        confidence: DETERMINISTIC_MATCH_CONFIDENCE,
      };
    case 'criar_nota':
      return {
        kind: 'note.create',
        payload: { title: intent.title, content: intent.content, category: intent.category },
        confidence: DETERMINISTIC_MATCH_CONFIDENCE,
      };
    case 'criar_documento':
      return {
        kind: 'document.store',
        payload: { title: intent.title, category: intent.category, expiresAt: intent.expiresAt },
        confidence: DETERMINISTIC_MATCH_CONFIDENCE,
      };
    default:
      return undefined;
  }
}

/**
 * Decision Engine (CONTROL HUB — Fase 4: "o objetivo é criar uma
 * arquitetura onde a IA consiga executar ações reais... ainda NÃO utilizar
 * IA real. Continuar utilizando mocks no Decision Engine.").
 * `MockDecisionEngine` continua sendo um mock — não é um provedor de IA —
 * mas agora reaproveita `parseIntent` (`services/nova/intent/parser.ts`,
 * regex determinística já usada por `MockAIProvider`) em vez de sempre
 * responder com o mesmo texto fixo, exatamente para "validar toda a
 * arquitetura do Action Engine" com os exemplos literais do pedido ("Gastei
 * R$ 350 no supermercado", "Amanhã às 15h reunião com Ricardo").
 *
 * Quando este componente ganhar inteligência de verdade (fase futura — ver
 * a recomendação do próprio usuário: "Decision Engine com IA" depois desta
 * fase), é aqui que a lógica muda de regex para chamadas a um modelo real;
 * `ActionRequest`/`DecisionResult` (o contrato de saída) não mudam.
 */
export class MockDecisionEngine implements DecisionEngine {
  async decide(message: HubMessage, _context: UserContext): Promise<DecisionResult> {
    const intent = parseIntent(message.content);
    const action = toActionRequest(intent);

    if (!action) {
      return {
        kind: 'reply',
        reply: `[Control Hub · mock] mensagem recebida do canal "${message.channel}": "${message.content}"`,
        actions: [],
      };
    }

    return { kind: 'execute_actions', actions: [action] };
  }
}

export const decisionEngine: DecisionEngine = new MockDecisionEngine();
