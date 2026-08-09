import 'server-only';

import { randomUUID } from 'node:crypto';
import { buildFinancialStatusReply } from '@/services/ai/conversation/FinancialIntentGuard';
import { dailyOverviewService, formatDailyOverviewReply, type DailyOverviewService } from '@/services/daily-overview';
import type { FinancialIntelligenceService } from '@/services/financial-intelligence';
import { financialIntelligenceService } from '@/services/financial-intelligence/financial-intelligence.sources';
import { completedResult, failedResult, processingResult } from './nova-orchestrator.contracts';
import { isNovaServerOrchestratorEnabled } from './nova-orchestrator-persistence.config';
import {
  novaOrchestratorPersistence,
  type NovaPersistedPublicMessage,
  type PrismaNovaOrchestratorPersistence,
} from './nova-orchestrator-persistence.repository';
import { resolveReadOnlyFinancialReference, type ResolvedReadOnlyReference } from './nova-reference-resolver';
import { routeNovaReadOnlyMessage, type NovaReadOnlyRoute } from './nova-read-only-routing';
import type { NovaOrchestratorResultDTO, NovaPublicMessageDTO, NovaReferenceSelection } from './nova-orchestrator.types';

export type NovaReadOnlyOrchestratorOutcome =
  | { kind: 'RESULT'; result: NovaOrchestratorResultDTO }
  | { kind: 'NOT_FOUND' }
  | { kind: 'DISABLED' };

interface ReadOnlyDependencies {
  persistence: PrismaNovaOrchestratorPersistence;
  finances: Pick<FinancialIntelligenceService, 'getStatus'>;
  overview: Pick<DailyOverviewService, 'getOverview'>;
  enabled: () => boolean;
  now: () => Date;
  ownerId: () => string;
}

const publicMessage = (message: NovaPersistedPublicMessage): NovaPublicMessageDTO => ({
  id: message.id,
  role: message.role,
  content: message.content,
  intent: message.intent,
  redacted: message.redacted,
  createdAt: message.createdAt.toISOString(),
});

function semanticReference(reference: ResolvedReadOnlyReference): NovaReferenceSelection {
  return { kind: 'SET', setReference: reference.setReference, entityType: reference.focusCategory ?? 'FINANCIAL_COMMITMENT' };
}

export class NovaReadOnlyOrchestratorService {
  constructor(private readonly dependencies: ReadOnlyDependencies = {
    persistence: novaOrchestratorPersistence,
    finances: financialIntelligenceService,
    overview: dailyOverviewService,
    enabled: isNovaServerOrchestratorEnabled,
    now: () => new Date(),
    ownerId: () => `web:${randomUUID()}`,
  }) {}

  async process(input: { userId: string; conversationId: string; clientTurnId: string; content: string }): Promise<NovaReadOnlyOrchestratorOutcome> {
    if (!this.dependencies.enabled()) return { kind: 'DISABLED' };
    const conversation = await this.dependencies.persistence.findAccessibleActiveWebConversation(input);
    if (!conversation) return { kind: 'NOT_FOUND' };

    const now = this.dependencies.now();
    const created = await this.dependencies.persistence.createOrReplayTurn(input);
    if (!created) return { kind: 'NOT_FOUND' };
    if (created.replayed) {
      const replay = await this.dependencies.persistence.replayTurn({ ...input, turnId: created.turn.id, now });
      if (!replay) return { kind: 'NOT_FOUND' };
      if (replay.kind === 'COMPLETED') {
        return { kind: 'RESULT', result: completedResult(replay.turn.id, replay.messages.map(publicMessage)) };
      }
      if (replay.kind === 'PROCESSING') return { kind: 'RESULT', result: processingResult(replay.turn.id) };
      if (replay.kind === 'TERMINAL') {
        return { kind: 'RESULT', result: failedResult(replay.turn.id, 'TURN_TERMINAL', 'Este turno foi encerrado e não será processado novamente.') };
      }
    }

    const claim = await this.dependencies.persistence.claimTurn({
      turnId: created.turn.id,
      conversationId: input.conversationId,
      userId: input.userId,
      expectedVersion: created.turn.version,
      owner: this.dependencies.ownerId(),
      now,
    });
    if (!claim) return { kind: 'RESULT', result: processingResult(created.turn.id) };

    try {
      const [semanticState, recentMessages] = await Promise.all([
        this.dependencies.persistence.getSemanticState({ conversationId: input.conversationId, userId: input.userId, now }),
        this.dependencies.persistence.listRecentMessages({ conversationId: input.conversationId, userId: input.userId }),
      ]);
      const reference = resolveReadOnlyFinancialReference({ message: input.content, semanticState, recentMessages });
      const initialRoute = routeNovaReadOnlyMessage(input.content);
      const route: NovaReadOnlyRoute = reference ? { kind: 'FINANCIAL_STATUS', focusCategory: reference.focusCategory } : initialRoute;
      const response = await this.respond(input.userId, route);
      const state = reference ?? (route.kind === 'FINANCIAL_STATUS'
        ? { intentFamily: 'FINANCIAL_STATUS' as const, focusCategory: route.focusCategory, focusType: route.focusCategory ? 'CATEGORY' as const : 'SET' as const, setReference: route.focusCategory ?? 'OVERDUE_COMMITMENTS' }
        : null);
      const completed = await this.dependencies.persistence.completeReadOnlyTurn({
        turnId: claim.id,
        conversationId: input.conversationId,
        userId: input.userId,
        expectedVersion: claim.version,
        owner: claim.processingOwner!,
        leaseToken: claim.processingLeaseToken!,
        now: this.dependencies.now(),
        intentFamily: state?.intentFamily ?? route.kind,
        focusCategory: state?.focusCategory ?? null,
        focusType: state?.focusType ?? null,
        focusReference: state ? semanticReference(state) : null,
        userContent: input.content,
        assistantContent: response,
      });
      if (!completed) return { kind: 'RESULT', result: processingResult(claim.id) };
      return { kind: 'RESULT', result: completedResult(claim.id, completed.messages.map(publicMessage)) };
    } catch {
      await this.dependencies.persistence.failTurn({
        turnId: claim.id,
        conversationId: input.conversationId,
        userId: input.userId,
        expectedVersion: claim.version,
        owner: claim.processingOwner!,
        leaseToken: claim.processingLeaseToken!,
        now: this.dependencies.now(),
        errorCode: 'READ_ONLY_SOURCE_UNAVAILABLE',
      });
      return { kind: 'RESULT', result: failedResult(claim.id, 'SOURCE_UNAVAILABLE', 'Não foi possível consultar as fontes reais agora.') };
    }
  }

  private async respond(userId: string, route: NovaReadOnlyRoute): Promise<string> {
    if (route.kind === 'FINANCIAL_STATUS') {
      return buildFinancialStatusReply(await this.dependencies.finances.getStatus(userId), route.focusCategory);
    }
    if (route.kind === 'DAILY_OVERVIEW') {
      return formatDailyOverviewReply(await this.dependencies.overview.getOverview(userId));
    }
    if (route.kind === 'BLOCKED_MUTATION') {
      return 'Essa operação não está disponível neste fluxo somente leitura. Nenhuma alteração foi realizada.';
    }
    return 'Este fluxo seguro ainda atende apenas consultas de situação financeira e resumo operacional.';
  }
}

export const novaReadOnlyOrchestratorService = new NovaReadOnlyOrchestratorService();
