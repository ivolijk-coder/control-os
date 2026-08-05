import type { ContextCoverageDTO } from '@/services/context-provider';
import type { FinancialStatusDTO } from '@/services/financial-intelligence';

export interface DailyOverviewDTO {
  referenceDate: string;
  generatedAt: string;
  profile: { name: string } | null;
  financialStatus: FinancialStatusDTO | null;
  documents: { total: number; pendingAnalysis: number; failedAnalysis: number } | null;
  operationalTasks: { pending: number; waitingUser: number } | null;
  coverage: ContextCoverageDTO[];
}
