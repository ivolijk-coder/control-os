import { describe, expect, it } from 'vitest';
import type { ContextProvider } from '@/services/context-provider';
import type { FinancialIntelligenceService } from '@/services/financial-intelligence';
import { DailyOverviewService, formatDailyOverviewForModel, formatDailyOverviewReply } from '../daily-overview.service';

const contextProvider: ContextProvider = {
  async getUserContext(userId) {
    return {
      profile: { id: userId, name: 'Ivoli' },
      documents: { total: 0, pendingAnalysis: 0, failedAnalysis: 0 },
      operationalTasks: { pending: 0, waitingUser: 0 },
      runtime: { referenceDate: '2026-08-05', generatedAt: '2026-08-05T12:00:00.000Z', timezone: 'America/Sao_Paulo' },
      coverage: [
        { domain: 'PROFILE', status: 'AVAILABLE' },
        { domain: 'FINANCE', status: 'AVAILABLE' },
        { domain: 'DOCUMENTS', status: 'AVAILABLE' },
        { domain: 'TRIPS', status: 'NOT_IMPLEMENTED' },
      ],
    };
  },
};

const financialStatus = {
  referenceDate: '2026-08-05T00:00:00.000Z', totalOverdue: 0, overdueCount: 0, categories: [], upcomingCommitments: [],
  availableBalance: 100, projectedBalance: 100, projectionHorizonDays: 30,
  dataCoverage: [{ source: 'CARDS' as const, status: 'NOT_IMPLEMENTED' as const }], generatedAt: '2026-08-05T12:00:00.000Z',
};

describe('DailyOverviewService', () => {
  it('preserva zero real quando a fonte foi consultada', async () => {
    const finances: FinancialIntelligenceService = { async getStatus() { return financialStatus; } };
    const overview = await new DailyOverviewService(contextProvider, finances).getOverview('user-a');
    expect(formatDailyOverviewReply(overview)).toContain('Não encontrei compromissos vencidos nas fontes financeiras disponíveis.');
    expect(formatDailyOverviewReply(overview)).toContain('TRIPS');
  });

  it('não conclui ausência financeira quando a fonte falha', async () => {
    const finances: FinancialIntelligenceService = { async getStatus() { throw new Error('offline'); } };
    const overview = await new DailyOverviewService(contextProvider, finances).getOverview('user-a');
    expect(overview.financialStatus).toBeNull();
    expect(overview.coverage).toContainEqual({ domain: 'FINANCE', status: 'UNAVAILABLE' });
    expect(formatDailyOverviewReply(overview)).not.toContain('Não encontrei compromissos vencidos');
  });

  it('envia somente agregados seguros e cobertura ao modelo', async () => {
    const finances: FinancialIntelligenceService = { async getStatus() { return financialStatus; } };
    const overview = await new DailyOverviewService(contextProvider, finances).getOverview('user-a');
    const prompt = formatDailyOverviewForModel(overview);
    expect(prompt).toContain('DOCUMENTS');
    expect(prompt).toContain('CARDS=NOT_IMPLEMENTED');
    expect(prompt).not.toContain('Lisboa');
  });
});
