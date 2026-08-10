import { FinancialIntentGuard, resolveFinancialFocusCategory } from '@/services/ai/conversation/FinancialIntentGuard';
import type { FinancialStatusCategoryDTO } from '@/services/financial-intelligence';

export type NovaReadOnlyRoute =
  | { kind: 'FINANCIAL_STATUS'; focusCategory?: FinancialStatusCategoryDTO['type'] }
  | { kind: 'DAILY_OVERVIEW' }
  | { kind: 'BLOCKED_MUTATION' }
  /**
   * Pergunta de leitura que não casa com nenhuma capacidade determinística.
   * Antes da PR10.4 chamava-se `UNSUPPORTED` e devolvia recusa fixa; agora é
   * composta pelo `responseProvider`. O nome mudou porque a semântica mudou:
   * a mensagem passou a ser atendida, não recusada. Continua sendo o ÚLTIMO
   * ramo — `BLOCKED_MUTATION` é avaliado antes e permanece intocado.
   */
  | { kind: 'OPEN_QUESTION' };

const guard = new FinancialIntentGuard();
const DAILY_TERMS = /\b(?:resumo|visao|panorama|prioridades|importante|dia|hoje)\b/u;
const DAILY_REQUEST = /\b(?:como|o que|que|mostre|resuma|resumo|visao|panorama)\b/u;
const MUTATION_VERBS = /\b(?:cri\w*|cadastr\w*|registr\w*|pag\w*|confirm\w*|cancel\w*|estorn\w*|alter\w*|edit\w*|exclu\w*|transfer\w*)\b/u;
const FINANCIAL_NOUNS = /\b(?:receita|despesa|transacao|transferencia|emprestimo|financiamento|parcela|conta|divida)\b/u;

function normalized(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().replace(/[^a-z0-9\s]/gu, ' ').replace(/\s+/gu, ' ').trim();
}

export function routeNovaReadOnlyMessage(message: string): NovaReadOnlyRoute {
  const value = normalized(message);
  if (MUTATION_VERBS.test(value) && FINANCIAL_NOUNS.test(value)) return { kind: 'BLOCKED_MUTATION' };
  if (guard.classify(message) === 'FINANCIAL_STATUS') {
    return { kind: 'FINANCIAL_STATUS', focusCategory: resolveFinancialFocusCategory(message) };
  }
  if (DAILY_TERMS.test(value) && DAILY_REQUEST.test(value)) return { kind: 'DAILY_OVERVIEW' };
  return { kind: 'OPEN_QUESTION' };
}
