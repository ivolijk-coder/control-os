import { contextProvider as defaultContextProvider, type ContextProvider } from '@/services/context-provider';
import type { FinancialIntelligenceService } from '@/services/financial-intelligence';
import { financialIntelligenceService as defaultFinancialIntelligenceService } from '@/services/financial-intelligence/financial-intelligence.sources';
import type { DailyOverviewDTO } from './daily-overview.types';

export class DailyOverviewService {
  constructor(
    private readonly contexts: ContextProvider = defaultContextProvider,
    private readonly finances: FinancialIntelligenceService = defaultFinancialIntelligenceService
  ) {}

  async getOverview(userId: string): Promise<DailyOverviewDTO> {
    const context = await this.contexts.getUserContext(userId);
    const financeResult = await Promise.allSettled([this.finances.getStatus(userId)]);
    const financialStatus = financeResult[0]?.status === 'fulfilled' ? financeResult[0].value : null;
    const coverage = context.coverage.map((entry) =>
      entry.domain === 'FINANCE' && !financialStatus ? { ...entry, status: 'UNAVAILABLE' as const } : entry
    );

    return {
      referenceDate: context.runtime.referenceDate,
      generatedAt: context.runtime.generatedAt,
      profile: context.profile ? { name: context.profile.name } : null,
      financialStatus,
      documents: context.documents,
      operationalTasks: context.operationalTasks,
      coverage,
    };
  }

  async buildPromptContext(userId: string): Promise<string> {
    return formatDailyOverviewForModel(await this.getOverview(userId));
  }
}

export function formatDailyOverviewForModel(overview: DailyOverviewDTO): string {
  const lines = [
    `Data de referência: ${overview.referenceDate}.`,
    `Cobertura operacional: ${overview.coverage.map((entry) => `${entry.domain}=${entry.status}`).join(', ')}.`,
  ];
  if (overview.profile) lines.push(`Nome da conta autenticada: ${overview.profile.name}.`);
  if (overview.financialStatus) {
    lines.push(
      `Situação financeira real: ${overview.financialStatus.overdueCount} compromisso(s) vencido(s), total R$ ${overview.financialStatus.totalOverdue.toFixed(2)}, saldo disponível R$ ${overview.financialStatus.availableBalance.toFixed(2)}.`
    );
    lines.push(`Cobertura financeira: ${overview.financialStatus.dataCoverage.map((entry) => `${entry.source}=${entry.status}`).join(', ')}.`);
  }
  if (overview.documents) {
    lines.push(`Documentos reais: ${overview.documents.total}; análises pendentes: ${overview.documents.pendingAnalysis}; análises com falha/revisão: ${overview.documents.failedAnalysis}.`);
  }
  if (overview.operationalTasks) {
    lines.push(`Pendências operacionais reais: ${overview.operationalTasks.pending}; aguardando usuário: ${overview.operationalTasks.waitingUser}.`);
  }
  lines.push('Nunca trate domínios NOT_IMPLEMENTED ou UNAVAILABLE como ausência de dados do usuário. Omita-os ou declare a limitação.');
  return lines.join('\n');
}

export function formatDailyOverviewReply(overview: DailyOverviewDTO): string {
  const parts: string[] = [];
  if (overview.financialStatus) {
    parts.push(
      overview.financialStatus.overdueCount > 0
        ? `Você tem ${overview.financialStatus.overdueCount} compromisso(s) vencido(s), somando R$ ${overview.financialStatus.totalOverdue.toFixed(2)}.`
        : 'Não encontrei compromissos vencidos nas fontes financeiras disponíveis.'
    );
  }
  if (overview.operationalTasks && overview.operationalTasks.pending + overview.operationalTasks.waitingUser > 0) {
    parts.push(`Há ${overview.operationalTasks.pending + overview.operationalTasks.waitingUser} pendência(s) operacional(is) para acompanhar.`);
  }
  if (overview.documents?.pendingAnalysis) parts.push(`${overview.documents.pendingAnalysis} documento(s) aguardam análise.`);
  const unavailable = overview.coverage.filter((entry) => entry.status !== 'AVAILABLE').map((entry) => entry.domain);
  if (unavailable.length > 0) parts.push(`Cobertura ainda indisponível: ${unavailable.join(', ')}.`);
  return parts.join(' ') || 'Não encontrei dados reais disponíveis para montar o resumo agora.';
}

export const dailyOverviewService = new DailyOverviewService();
