import type {
  FinancialCommitmentDTO,
  FinancialDataCoverageDTO,
  FinancialStatusCategoryDTO,
  FinancialStatusDTO,
} from '@/services/financial-intelligence';
import type { NovaTurnResult } from '@/services/nova';
import type { ActionResult } from '@/services/action-result.types';
import { postFinanceAction } from '../finance-bridge';

export type FinancialIntentFamily = 'FINANCIAL_STATUS';

type FinancialStatusExecutor = () => Promise<ActionResult>;

interface FinancialConversationContext {
  focusCategory: FinancialStatusCategoryDTO['type'] | undefined;
  status: FinancialStatusDTO;
  updatedAt: number;
}

const FINANCIAL_CONTEXT_TTL_MS = 10 * 60 * 1000;

const FINANCIAL_STATUS_PATTERNS = [
  /\btenho\s+conta\s+atrasada\b/,
  /\btenho\s+algo\s+atrasado\b/,
  /\bestou\s+devendo\b/,
  /\bquanto\s+(?:eu\s+)?devo\b/,
  /\bquais\s+(?:sao\s+)?minhas\s+dividas\b/,
  /\bminhas\s+dividas\b/,
  /\b(?:como\s+)?estao\s+(?:as\s+)?minhas\s+dividas\b/,
  /\bestou\s+no\s+vermelho\b/,
  /\bcomo\s+esta\s+minha\s+situacao\s+financeira\b/,
  /\btenho\s+parcela\s+vencida\b/,
  /\bo\s+que\s+vence\s+(?:esta|essa|nessa)\s+semana\b/,
  /\b(?:emprestimo|emprestimos|financiamento|financiamentos|parcela|parcelas|divida|dividas|conta|contas)\b.*\b(?:atrasado|atrasada|atrasados|atrasadas|vencido|vencida|vencidos|vencidas|em atraso)\b/,
  /\b(?:atrasado|atrasada|atrasados|atrasadas|vencido|vencida|vencidos|vencidas|em atraso)\b.*\b(?:emprestimo|emprestimos|financiamento|financiamentos|parcela|parcelas|divida|dividas|conta|contas)\b/,
];

const FINANCIAL_FOLLOW_UP_PATTERNS = [
  /^(?:qual|quais|quanto|quantos|quando)(?:\s+.*)?$/,
  /^(?:mostre|mostrar|liste|listar|detalhe|detalhes)(?:\s+.*)?$/,
  /^(?:e|sobre)\s+(?:o|os|a|as)?\s*(?:emprestimo|emprestimos|financiamento|financiamentos|parcela|parcelas|divida|dividas|conta|contas)(?:\s+.*)?$/,
];

const CATEGORY_LABELS: Record<FinancialStatusCategoryDTO['type'], string> = {
  FIXED_ACCOUNT: 'Contas fixas',
  LOAN: 'Empréstimos',
  FINANCING: 'Financiamentos',
  CARD_INSTALLMENT: 'Parcelas de cartão',
  SUPPLIER: 'Fornecedores',
  CARD_STATEMENT: 'Faturas de cartão',
};

const SOURCE_LABELS: Record<FinancialDataCoverageDTO['source'], string> = {
  TRANSACTIONS: 'transações',
  ACCOUNTS: 'contas',
  FIXED_ACCOUNTS: 'contas fixas',
  FINANCIAL_CONTRACTS: 'empréstimos e financiamentos',
  CARDS: 'cartões',
};

function normalizeMessage(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCommitment(value: unknown): value is FinancialCommitmentDTO {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.amount === 'number'
    && typeof value.dueDate === 'string'
    && typeof value.source === 'string'
    && typeof value.sourceType === 'string'
    && typeof value.status === 'string';
}

function isCategory(value: unknown): value is FinancialStatusCategoryDTO {
  return isRecord(value)
    && typeof value.type === 'string'
    && typeof value.count === 'number'
    && typeof value.total === 'number'
    && Array.isArray(value.items)
    && value.items.every(isCommitment);
}

function isCoverage(value: unknown): value is FinancialDataCoverageDTO {
  return isRecord(value) && typeof value.source === 'string' && typeof value.status === 'string';
}

export function isFinancialStatusDTO(value: unknown): value is FinancialStatusDTO {
  return isRecord(value)
    && typeof value.referenceDate === 'string'
    && typeof value.totalOverdue === 'number'
    && typeof value.overdueCount === 'number'
    && Array.isArray(value.categories)
    && value.categories.every(isCategory)
    && Array.isArray(value.upcomingCommitments)
    && value.upcomingCommitments.every(isCommitment)
    && typeof value.availableBalance === 'number'
    && (typeof value.projectedBalance === 'number' || value.projectedBalance === null)
    && typeof value.projectionHorizonDays === 'number'
    && Array.isArray(value.dataCoverage)
    && value.dataCoverage.every(isCoverage)
    && typeof value.generatedAt === 'string';
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function resolveFocusCategory(normalized: string): FinancialStatusCategoryDTO['type'] | undefined {
  if (/\bemprestimo(?:s)?\b/.test(normalized)) return 'LOAN';
  if (/\bfinanciamento(?:s)?\b/.test(normalized)) return 'FINANCING';
  if (/\b(?:conta fixa|contas fixas)\b/.test(normalized)) return 'FIXED_ACCOUNT';
  if (/\b(?:cartao|cartoes|fatura|faturas)\b/.test(normalized)) return 'CARD_STATEMENT';
  return undefined;
}

function buildCoverageNote(status: FinancialStatusDTO): string {
  const available = status.dataCoverage
    .filter((coverage) => coverage.status === 'AVAILABLE')
    .map((coverage) => SOURCE_LABELS[coverage.source]);
  const notImplemented = status.dataCoverage
    .filter((coverage) => coverage.status === 'NOT_IMPLEMENTED')
    .map((coverage) => SOURCE_LABELS[coverage.source]);
  const unavailable = status.dataCoverage
    .filter((coverage) => coverage.status === 'UNAVAILABLE')
    .map((coverage) => SOURCE_LABELS[coverage.source]);

  const lines: string[] = [];
  if (available.length > 0) lines.push(`Consultei: ${available.join(', ')}.`);
  if (notImplemented.length > 0) lines.push(`Ainda não consultei: ${notImplemented.join(', ')}.`);
  if (unavailable.length > 0) {
    lines.push(`Temporariamente indisponível: ${unavailable.join(', ')}. Não completei essa visão com suposições.`);
  }
  return lines.length > 0 ? `\n\n${lines.join('\n')}` : '';
}

function buildCommitmentLines(items: FinancialCommitmentDTO[]): string {
  return items
    .map((item) => {
      const overdue = item.daysOverdue === undefined ? '' : ` — ${item.daysOverdue} dia${item.daysOverdue === 1 ? '' : 's'} em atraso`;
      return `- ${item.title}: ${formatCurrency(item.amount)} — venceu em ${new Date(item.dueDate).toLocaleDateString('pt-BR')}${overdue}`;
    })
    .join('\n');
}

export function buildFinancialStatusReply(
  status: FinancialStatusDTO,
  focusCategory?: FinancialStatusCategoryDTO['type']
): string {
  const coverageNote = buildCoverageNote(status);
  const focused = focusCategory
    ? status.categories.find((category) => category.type === focusCategory)
    : undefined;

  if (focusCategory) {
    if (!focused || focused.count === 0) {
      return `Não encontrei ${CATEGORY_LABELS[focusCategory].toLocaleLowerCase('pt-BR')} em atraso.${coverageNote}`;
    }
    const items = buildCommitmentLines(focused.items);
    return `Encontrei ${focused.count} em ${CATEGORY_LABELS[focusCategory].toLocaleLowerCase('pt-BR')}, totalizando ${formatCurrency(focused.total)}:${items ? `\n${items}` : ''}${coverageNote}`;
  }

  if (status.overdueCount === 0) {
    if (status.upcomingCommitments.length === 0) {
      return `Não encontrei compromissos financeiros vencidos nem próximos no período consultado.${coverageNote}`;
    }

    const upcoming = status.upcomingCommitments
      .map((item) => `- ${item.title}: ${formatCurrency(item.amount)} — vence em ${new Date(item.dueDate).toLocaleDateString('pt-BR')}`)
      .join('\n');
    return `Não encontrei compromissos vencidos. Estes são os próximos:\n${upcoming}${coverageNote}`;
  }

  const categoryLines = status.categories
    .map((category) => `- ${CATEGORY_LABELS[category.type]}: ${category.count} — ${formatCurrency(category.total)}`)
    .join('\n');

  return `Encontrei ${status.overdueCount} compromisso${status.overdueCount === 1 ? '' : 's'} vencido${status.overdueCount === 1 ? '' : 's'}:\n${categoryLines}\n\nTotal em atraso: ${formatCurrency(status.totalOverdue)}.${coverageNote}`;
}

/**
 * Barreira determinística anterior ao modelo: perguntas críticas de status
 * financeiro sempre consultam a capability autenticada antes da resposta.
 */
export class FinancialIntentGuard {
  private readonly contextBySession = new Map<string, FinancialConversationContext>();

  constructor(
    private readonly executeStatus: FinancialStatusExecutor = () =>
      postFinanceAction('financial_status.get', {})
  ) {}

  classify(text: string): FinancialIntentFamily | undefined {
    const normalized = normalizeMessage(text);
    return FINANCIAL_STATUS_PATTERNS.some((pattern) => pattern.test(normalized))
      ? 'FINANCIAL_STATUS'
      : undefined;
  }

  async handle(text: string, sessionId: string = 'default'): Promise<NovaTurnResult | undefined> {
    const normalized = normalizeMessage(text);
    const family = this.classify(text);
    const previous = this.getFreshContext(sessionId);
    const isFollowUp = previous !== undefined
      && FINANCIAL_FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(normalized));

    if (family !== 'FINANCIAL_STATUS' && !isFollowUp) return undefined;

    return this.getStatus(sessionId, resolveFocusCategory(normalized) ?? previous?.focusCategory);
  }

  /** Executa a consulta obrigatória quando outro resolver já classificou a família financeira. */
  async getStatus(
    sessionId: string = 'default',
    focusCategory?: FinancialStatusCategoryDTO['type']
  ): Promise<NovaTurnResult> {
    const result = await this.executeStatus();
    if (!result.success || !isFinancialStatusDTO(result.data)) {
      return {
        status: 'erro',
        reply: result.success
          ? 'Não foi possível validar os dados financeiros retornados agora.'
          : result.message,
        checklist: [],
        results: [],
      };
    }

    this.contextBySession.set(sessionId, {
      focusCategory,
      status: result.data,
      updatedAt: Date.now(),
    });

    return {
      status: 'concluido',
      reply: buildFinancialStatusReply(result.data, focusCategory),
      checklist: [],
      results: [],
    };
  }

  private getFreshContext(sessionId: string): FinancialConversationContext | undefined {
    const context = this.contextBySession.get(sessionId);
    if (!context) return undefined;
    if (Date.now() - context.updatedAt <= FINANCIAL_CONTEXT_TTL_MS) return context;
    this.contextBySession.delete(sessionId);
    return undefined;
  }
}

export const financialIntentGuard = new FinancialIntentGuard();
