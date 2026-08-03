/**
 * Contratos de leitura da Financial Intelligence Layer.
 *
 * Esta camada não é uma nova fonte de verdade financeira: ela apenas define
 * o formato mínimo que uma composição futura de FinanceService e dos demais
 * serviços financeiros entregará à NOVA.
 *
 * Valores monetários seguem o padrão atual do projeto: `number` em reais.
 * Datas atravessam a borda como strings ISO 8601.
 */

export const FINANCIAL_OBLIGATION_CATEGORIES = [
  'FIXED_ACCOUNT',
  'LOAN',
  'FINANCING',
  'CARD_INSTALLMENT',
  'SUPPLIER',
  'CARD_STATEMENT',
] as const;

export type FinancialObligationCategory = (typeof FINANCIAL_OBLIGATION_CATEGORIES)[number];

export const FINANCIAL_DATA_SOURCES = [
  'TRANSACTIONS',
  'ACCOUNTS',
  'FIXED_ACCOUNTS',
  'FINANCIAL_CONTRACTS',
  'CARDS',
] as const;

export type FinancialDataSource = (typeof FINANCIAL_DATA_SOURCES)[number];

export const DATA_COVERAGE_STATUSES = ['AVAILABLE', 'NOT_IMPLEMENTED', 'UNAVAILABLE'] as const;

export type DataCoverageStatus = (typeof DATA_COVERAGE_STATUSES)[number];

export type FinancialCommitmentStatus = 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING';

export interface FinancialCommitmentDTO {
  id: string;
  source: FinancialDataSource;
  sourceType: FinancialObligationCategory;
  title: string;
  /** Valor em reais, seguindo os contratos financeiros atuais. */
  amount: number;
  /** Data de vencimento em ISO 8601. */
  dueDate: string;
  status: FinancialCommitmentStatus;
  daysOverdue?: number;
}

export interface FinancialStatusCategoryDTO {
  type: FinancialObligationCategory;
  count: number;
  /** Total em reais. */
  total: number;
  items: FinancialCommitmentDTO[];
}

export interface FinancialDataCoverageDTO {
  source: FinancialDataSource;
  status: DataCoverageStatus;
}

export interface FinancialStatusDTO {
  /** Data de referência da consulta em ISO 8601. */
  referenceDate: string;
  /** Total vencido em reais. */
  totalOverdue: number;
  overdueCount: number;
  categories: FinancialStatusCategoryDTO[];
  upcomingCommitments: FinancialCommitmentDTO[];
  /** Saldo disponível em reais, futuramente fornecido pelo FinanceService. */
  availableBalance: number;
  /** Saldo projetado em reais; `null` quando não puder ser calculado com cobertura suficiente. */
  projectedBalance: number | null;
  projectionHorizonDays: number;
  dataCoverage: FinancialDataCoverageDTO[];
  /** Instante de geração do DTO em ISO 8601. */
  generatedAt: string;
}

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function calendarDayUtc(value: string): number {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`Data ISO inválida: ${value}`);
  const datePart = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!datePart) throw new TypeError(`Data ISO inválida: ${value}`);
  return Date.UTC(Number(datePart[1]), Number(datePart[2]) - 1, Number(datePart[3]));
}

/** Calcula dias civis completos de atraso, sem produzir valores negativos. */
export function calculateDaysOverdue(dueDate: string, referenceDate: string): number {
  return Math.max(0, Math.floor((calendarDayUtc(referenceDate) - calendarDayUtc(dueDate)) / DAY_IN_MILLISECONDS));
}

/**
 * Normaliza somente campos de apresentação seguros para a NOVA. Não resolve
 * status financeiro nem altera valores; essas decisões continuarão nos
 * serviços financeiros existentes.
 */
export function normalizeFinancialCommitment(
  commitment: Omit<FinancialCommitmentDTO, 'daysOverdue'> & { daysOverdue?: number },
  referenceDate: string
): FinancialCommitmentDTO {
  const normalized: FinancialCommitmentDTO = {
    id: commitment.id,
    source: commitment.source,
    sourceType: commitment.sourceType,
    title: commitment.title.trim(),
    amount: commitment.amount,
    dueDate: new Date(commitment.dueDate).toISOString(),
    status: commitment.status,
  };

  if (commitment.status === 'OVERDUE') {
    normalized.daysOverdue = calculateDaysOverdue(commitment.dueDate, referenceDate);
  }

  return normalized;
}

/** Agrupa compromissos vencidos sem consultar ou modificar qualquer fonte financeira. */
export function groupOverdueCommitments(commitments: readonly FinancialCommitmentDTO[]): FinancialStatusCategoryDTO[] {
  const grouped = new Map<FinancialObligationCategory, FinancialCommitmentDTO[]>();

  for (const commitment of commitments) {
    if (commitment.status !== 'OVERDUE') continue;
    const items = grouped.get(commitment.sourceType) ?? [];
    items.push(commitment);
    grouped.set(commitment.sourceType, items);
  }

  return FINANCIAL_OBLIGATION_CATEGORIES.flatMap((type) => {
    const items = grouped.get(type);
    if (!items?.length) return [];
    return [{ type, count: items.length, total: items.reduce((sum, item) => sum + item.amount, 0), items }];
  });
}

/** Gera cobertura completa e determinística; fontes não informadas ficam explicitamente não implementadas. */
export function buildFinancialDataCoverage(
  coverage: Partial<Record<FinancialDataSource, DataCoverageStatus>>
): FinancialDataCoverageDTO[] {
  return FINANCIAL_DATA_SOURCES.map((source) => ({ source, status: coverage[source] ?? 'NOT_IMPLEMENTED' }));
}
