import { FinancialIntentGuard, resolveFinancialFocusCategory } from '@/services/ai/conversation/FinancialIntentGuard';
import type { FinancialStatusCategoryDTO } from '@/services/financial-intelligence';
import type { NovaConversationSemanticState, ReferenceMessage } from './nova-orchestrator.types';

export interface ResolvedReadOnlyReference {
  intentFamily: 'FINANCIAL_STATUS';
  focusCategory?: FinancialStatusCategoryDTO['type'];
  focusType: 'CATEGORY' | 'SET';
  setReference: string;
}

const guard = new FinancialIntentGuard();
const ANAPHORA = /\b(?:ele|ela|eles|elas|esse|essa|esses|essas|aquele|aquela|aqueles|aquelas|outro|outra|anterior|proximo|segunda?|terceir[oa])\b/u;
const ELLIPSIS = /^(?:qual|quais|quanto|quantos|quando|onde|mostre|liste|detalhe)(?:\s+.*)?$/u;

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().replace(/[^a-z0-9\s]/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function fromMessage(message: string): ResolvedReadOnlyReference | null {
  if (guard.classify(message) !== 'FINANCIAL_STATUS') return null;
  const focusCategory = resolveFinancialFocusCategory(message);
  return {
    intentFamily: 'FINANCIAL_STATUS',
    focusCategory,
    focusType: focusCategory ? 'CATEGORY' : 'SET',
    setReference: focusCategory ?? 'OVERDUE_COMMITMENTS',
  };
}

function fromState(state: NovaConversationSemanticState | null): ResolvedReadOnlyReference | null {
  if (!state || state.intentFamily !== 'FINANCIAL_STATUS') return null;
  const focusCategory = state.focusCategory as FinancialStatusCategoryDTO['type'] | null;
  return {
    intentFamily: 'FINANCIAL_STATUS',
    focusCategory: focusCategory ?? undefined,
    focusType: focusCategory ? 'CATEGORY' : 'SET',
    setReference: state.focusReference?.kind === 'SET' ? state.focusReference.setReference : (focusCategory ?? 'OVERDUE_COMMITMENTS'),
  };
}

/**
 * Estado e histórico COMPLEMENTAM uma mensagem anafórica/elíptica; nunca
 * sobrescrevem uma categoria que a própria mensagem declarou (B4a).
 *
 * O caso real que revelou isso: `Quando vence esse empréstimo?` não casa com
 * nenhum `FINANCIAL_STATUS_PATTERNS` — o padrão que aceitaria a palavra-chave
 * exige um termo de atraso, e `vence` no presente não está na lista. Logo
 * `fromMessage()` devolve `null` antes de consultar
 * `resolveFinancialFocusCategory`, e a palavra "empréstimo", explícita e
 * inequívoca, era descartada em favor do foco persistido — que em produção
 * era `FIXED_ACCOUNT`. A resposta falava de contas fixas.
 *
 * A correção é aqui, e não em `FinancialIntentGuard`: aquele guard também
 * alimenta o pipeline legado (`ConversationService`), então alterar seus
 * padrões mudaria o comportamento dos dois cérebros de uma vez.
 */
function withExplicitCategory(
  reference: ResolvedReadOnlyReference,
  explicit: FinancialStatusCategoryDTO['type'] | undefined
): ResolvedReadOnlyReference {
  if (!explicit || reference.focusCategory === explicit) return reference;
  return { ...reference, focusCategory: explicit, focusType: 'CATEGORY', setReference: explicit };
}

export function resolveReadOnlyFinancialReference(input: {
  message: string;
  semanticState: NovaConversationSemanticState | null;
  recentMessages: readonly ReferenceMessage[];
}): ResolvedReadOnlyReference | null {
  const direct = fromMessage(input.message);
  if (direct) return direct;
  const value = normalize(input.message);
  if (!ANAPHORA.test(value) && !ELLIPSIS.test(value)) return null;
  const explicit = resolveFinancialFocusCategory(input.message);
  const persisted = fromState(input.semanticState);
  if (persisted) return withExplicitCategory(persisted, explicit);
  for (const message of [...input.recentMessages].reverse()) {
    if (message.role !== 'USER') continue;
    const recovered = fromMessage(message.content);
    if (recovered) return withExplicitCategory(recovered, explicit);
  }
  return null;
}
