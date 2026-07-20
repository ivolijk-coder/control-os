import { parseIntent } from '@/services/nova';
import type { NovaIntent } from '@/services/nova';
import type { DecisionEngine, DecisionResult, HubMessage, ActionRequest } from '@/services/control-hub';
import type { UserContext } from '@/services/context-provider';

/**
 * `MockDecisionProvider` — CONTROL HUB Fase 5: "Criar dois modos:
 * MockDecisionProvider e OpenAIDecisionProvider. Trocar entre eles apenas
 * por configuração." Este é o modo mock — sem IA nenhuma, mesmo motor
 * determinístico (`parseIntent`, regex) que já existia como
 * `MockDecisionEngine` desde a Fase 4.
 *
 * Movido de `services/control-hub/decision-engine.ts` para cá (renomeado
 * de `MockDecisionEngine` para `MockDecisionProvider`, nome literal do
 * pedido) sem NENHUMA mudança de comportamento — mesmo `parseIntent`, mesmo
 * mapeamento de intents pra `ActionKind`, mesma confiança fixa. Só mudou
 * ONDE o código mora: `services/control-hub/decision-engine.ts` virou a
 * composição raiz que ESCOLHE entre este provider e `OpenAIDecisionProvider`
 * (ver aquele arquivo) — o mesmo papel que `services/ai/config.ts` já
 * cumpre pro provedor de IA do pipeline de conversa antigo
 * (`getAIProvider()`), agora espelhado aqui pro Decision Engine.
 */
const DETERMINISTIC_MATCH_CONFIDENCE = 0.92;

/**
 * Traduz uma `NovaIntent` (vocabulário de domínio já usado por
 * `services/nova`/`services/ai`) para uma `ActionRequest` (vocabulário do
 * Action Engine) — só para as intents que já têm uma Action real
 * implementada (`services/action-engine/actions/`). As demais intents
 * continuam respondendo via `kind: 'reply'`, como antes.
 */
function toActionRequest(intent: NovaIntent): ActionRequest | undefined {
  switch (intent.kind) {
    case 'registrar_despesa':
      return {
        kind: 'expense.create',
        payload: { amount: intent.amount, description: intent.description },
        confidence: DETERMINISTIC_MATCH_CONFIDENCE,
      };
    case 'registrar_receita':
      // CONTROL OS — Fase 6: `registrar_receita` já era reconhecida por
      // `parseIntent` desde antes desta fase (mesma regex de
      // `registrar_despesa`), mas não tinha nenhuma Action real pra virar
      // até `income.create` existir (`services/action-engine/actions/finance/
      // create-income.action.ts`).
      return {
        kind: 'income.create',
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

export class MockDecisionProvider implements DecisionEngine {
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
