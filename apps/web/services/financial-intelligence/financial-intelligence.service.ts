import type { FixedAccountOccurrence } from '@control-os/types';
import type { FinancialContract, FinancialContractType, FinancialInstallment } from '@/services/finance-contracts';
import type { FinancialIntelligenceService, FinancialStatusQuery } from './financial-intelligence.interfaces';
import type { FinancialIntelligenceSources } from './financial-intelligence.sources';
import {
  buildFinancialDataCoverage,
  groupOverdueCommitments,
  normalizeFinancialCommitment,
} from './financial-intelligence.types';
import type {
  DataCoverageStatus,
  FinancialCommitmentDTO,
  FinancialObligationCategory,
  FinancialStatusDTO,
} from './financial-intelligence.types';

const DEFAULT_PROJECTION_HORIZON_DAYS = 30;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

type OpenFixedOccurrence = FixedAccountOccurrence & { remainingAmount: number };
type OpenContractInstallment = { contract: FinancialContract; installment: FinancialInstallment };

function parseDate(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} precisa ser uma data ISO válida.`);
  return parsed;
}

function startOfUtcDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function commitmentStatus(dueDate: string, referenceDate: Date): FinancialCommitmentDTO['status'] {
  const dueDay = startOfUtcDay(parseDate(dueDate, 'dueDate'));
  const referenceDay = startOfUtcDay(referenceDate);
  if (dueDay < referenceDay) return 'OVERDUE';
  if (dueDay === referenceDay) return 'DUE_TODAY';
  return 'UPCOMING';
}

function isWithinProjection(dueDate: string, referenceDate: Date, horizonDays: number): boolean {
  const dueDay = startOfUtcDay(parseDate(dueDate, 'dueDate'));
  const referenceDay = startOfUtcDay(referenceDate);
  return dueDay <= referenceDay + horizonDays * DAY_IN_MILLISECONDS;
}

function contractCategory(type: FinancialContractType): FinancialObligationCategory {
  return type;
}

function openFixedOccurrences(occurrences: readonly FixedAccountOccurrence[]): OpenFixedOccurrence[] {
  return occurrences.flatMap((occurrence) => {
    if (occurrence.status !== 'pendente' && occurrence.status !== 'parcial') return [];
    const remainingAmount = Math.max(0, occurrence.amount - occurrence.paidAmount);
    return remainingAmount > 0 ? [{ ...occurrence, remainingAmount }] : [];
  });
}

function openContractInstallments(contracts: readonly FinancialContract[]): OpenContractInstallment[] {
  return contracts.flatMap((contract) => {
    if (contract.status !== 'ACTIVE') return [];
    return (contract.installments ?? [])
      .filter((installment) => installment.status === 'PENDING' || installment.status === 'OVERDUE')
      .map((installment) => ({ contract, installment }));
  });
}

function fixedCommitments(occurrences: readonly OpenFixedOccurrence[], referenceDate: string): FinancialCommitmentDTO[] {
  return occurrences
    .filter((occurrence) => occurrence.type === 'despesa')
    .map((occurrence) => normalizeFinancialCommitment({
      id: occurrence.id,
      source: 'FIXED_ACCOUNTS',
      sourceType: 'FIXED_ACCOUNT',
      title: occurrence.name,
      amount: occurrence.remainingAmount,
      dueDate: occurrence.dueDate,
      status: commitmentStatus(occurrence.dueDate, parseDate(referenceDate, 'referenceDate')),
    }, referenceDate));
}

function contractCommitments(rows: readonly OpenContractInstallment[], referenceDate: string): FinancialCommitmentDTO[] {
  return rows.map(({ contract, installment }) => normalizeFinancialCommitment({
    id: installment.id,
    source: 'FINANCIAL_CONTRACTS',
    sourceType: contractCategory(contract.type),
    title: contract.institution ? `${contract.institution} ${contract.name}` : contract.name,
    amount: installment.amount,
    dueDate: installment.dueDate,
    status: commitmentStatus(installment.dueDate, parseDate(referenceDate, 'referenceDate')),
  }, referenceDate));
}

/**
 * Composição de leitura. Não persiste, não muda status e não recalcula
 * saldo: consulta os serviços existentes e produz o DTO mínimo da NOVA.
 */
export class DefaultFinancialIntelligenceService implements FinancialIntelligenceService {
  constructor(
    private readonly sources: FinancialIntelligenceSources,
    private readonly now: () => Date = () => new Date()
  ) {}

  async getStatus(userId: string, query: FinancialStatusQuery = {}): Promise<FinancialStatusDTO> {
    if (!userId.trim()) throw new TypeError('userId é obrigatório.');

    const reference = query.referenceDate ? parseDate(query.referenceDate, 'referenceDate') : this.now();
    const referenceDate = reference.toISOString();
    const horizonDays = query.projectionHorizonDays ?? DEFAULT_PROJECTION_HORIZON_DAYS;
    if (!Number.isInteger(horizonDays) || horizonDays < 0) {
      throw new TypeError('projectionHorizonDays precisa ser um inteiro maior ou igual a zero.');
    }

    const [balanceResult, fixedResult, contractsResult] = await Promise.allSettled([
      this.sources.getAvailableBalance(userId),
      this.sources.listFixedAccountOccurrences(userId),
      this.sources.listFinancialContracts(userId),
    ]);

    const balanceAvailable = balanceResult.status === 'fulfilled';
    const fixedAvailable = fixedResult.status === 'fulfilled';
    const contractsAvailable = contractsResult.status === 'fulfilled';
    const availableBalance = balanceAvailable ? balanceResult.value : 0;
    const fixed = fixedAvailable ? openFixedOccurrences(fixedResult.value) : [];
    const contractRows = contractsAvailable ? openContractInstallments(contractsResult.value) : [];

    const commitments = [
      ...fixedCommitments(fixed, referenceDate),
      ...contractCommitments(contractRows, referenceDate),
    ];
    const overdue = commitments.filter((item) => item.status === 'OVERDUE');
    const upcomingCommitments = commitments.filter(
      (item) => item.status !== 'OVERDUE' && isWithinProjection(item.dueDate, reference, horizonDays)
    );

    const completeProjection = balanceAvailable && fixedAvailable && contractsAvailable;
    let projectedBalance: number | null = null;
    if (completeProjection) {
      const fixedEffect = fixed
        .filter((occurrence) => isWithinProjection(occurrence.dueDate, reference, horizonDays))
        .reduce((total, occurrence) => total + (occurrence.type === 'receita' ? occurrence.remainingAmount : -occurrence.remainingAmount), 0);
      const contractEffect = contractRows
        .filter(({ installment }) => isWithinProjection(installment.dueDate, reference, horizonDays))
        .reduce((total, { installment }) => total - installment.amount, 0);
      projectedBalance = availableBalance + fixedEffect + contractEffect;
    }

    const sourceStatus = (available: boolean): DataCoverageStatus => available ? 'AVAILABLE' : 'UNAVAILABLE';

    return {
      referenceDate,
      totalOverdue: overdue.reduce((total, item) => total + item.amount, 0),
      overdueCount: overdue.length,
      categories: groupOverdueCommitments(overdue),
      upcomingCommitments,
      availableBalance,
      projectedBalance,
      projectionHorizonDays: horizonDays,
      dataCoverage: buildFinancialDataCoverage({
        TRANSACTIONS: sourceStatus(balanceAvailable),
        ACCOUNTS: sourceStatus(balanceAvailable),
        FIXED_ACCOUNTS: sourceStatus(fixedAvailable),
        FINANCIAL_CONTRACTS: sourceStatus(contractsAvailable),
        CARDS: 'NOT_IMPLEMENTED',
      }),
      generatedAt: this.now().toISOString(),
    };
  }
}
