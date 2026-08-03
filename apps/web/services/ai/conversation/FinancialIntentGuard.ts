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
];

const CATEGORY_LABELS: Record<FinancialStatusCategoryDTO['type'], string> = {
  FIXED_ACCOUNT: 'Contas fixas',
  LOAN: 'Empréstimos',
  FINANCING: 'Financiamentos',
  CARD_INSTALLMENT: 'Parcelas de cartão',
  SUPPLIER: 'Fornecedores',
  CARD_STATEMENT: 'Faturas de cartão',
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

export function buildFinancialStatusReply(status: FinancialStatusDTO): string {
  const unavailable = status.dataCoverage.some((coverage) => coverage.status === 'UNAVAILABLE');
  const coverageNote = unavailable
    ? '\n\nParte dos dados financeiros está temporariamente indisponível; não vou completar essa visão com suposições.'
    : '';

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

  async handle(text: string): Promise<NovaTurnResult | undefined> {
    if (this.classify(text) !== 'FINANCIAL_STATUS') return undefined;

    return this.getStatus();
  }

  /** Executa a consulta obrigatória quando outro resolver já classificou a família financeira. */
  async getStatus(): Promise<NovaTurnResult> {
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

    return {
      status: 'concluido',
      reply: buildFinancialStatusReply(result.data),
      checklist: [],
      results: [],
    };
  }
}

export const financialIntentGuard = new FinancialIntentGuard();
