import 'server-only';

import { randomUUID } from 'node:crypto';
import { buildFinancialStatusReply } from '@/services/ai/conversation/FinancialIntentGuard';
import { contextProvider, type ContextProvider } from '@/services/context-provider';
import { dailyOverviewService, formatDailyOverviewReply, type DailyOverviewService } from '@/services/daily-overview';
import type { FinancialIntelligenceService } from '@/services/financial-intelligence';
import { financialIntelligenceService } from '@/services/financial-intelligence/financial-intelligence.sources';
import { completedResult, failedResult, processingResult } from './nova-orchestrator.contracts';
import { isNovaServerOrchestratorEnabledFor } from './nova-orchestrator-persistence.config';
import {
  novaOrchestratorPersistence,
  type NovaPersistedPublicMessage,
  type PrismaNovaOrchestratorPersistence,
} from './nova-orchestrator-persistence.repository';
import { resolveReadOnlyFinancialReference, type ResolvedReadOnlyReference } from './nova-reference-resolver';
import { routeNovaReadOnlyMessage, type NovaReadOnlyRoute } from './nova-read-only-routing';
import type { NovaReadOnlyPersona, NovaReadOnlyPromptMessage } from './nova-read-only-prompt';
import { novaReadOnlyResponseProvider, type NovaReadOnlyResponseProvider } from './nova-response-provider';
import type { NovaOrchestratorResultDTO, NovaPublicMessageDTO, NovaReferenceSelection } from './nova-orchestrator.types';

export type NovaReadOnlyOrchestratorOutcome =
  | { kind: 'RESULT'; result: NovaOrchestratorResultDTO }
  | { kind: 'NOT_FOUND' }
  | { kind: 'DISABLED' };

/**
 * Payload de entrada de `process()` — espelha exatamente o que a rota
 * HTTP (`POST /api/nova/conversations/:id/messages`) monta: `userId`/
 * `conversationId` do servidor + `clientTurnId`/`content` do corpo da
 * requisição (`parseProcessMessageBody`). `content` é legítimo aqui — só
 * não pode atravessar para `CreateOrReplayTurnInput` (ver
 * `nova-orchestrator-persistence.repository.ts`), que é a fronteira
 * persistível de `NovaTurn`.
 */
export interface ProcessMessageInput {
  userId: string;
  conversationId: string;
  clientTurnId: string;
  content: string;
}

interface ReadOnlyDependencies {
  persistence: PrismaNovaOrchestratorPersistence;
  finances: Pick<FinancialIntelligenceService, 'getStatus'>;
  overview: Pick<DailyOverviewService, 'getOverview'>;
  /** Contexto factual autenticado do servidor — nunca estado do navegador. */
  context: Pick<ContextProvider, 'getUserContext'>;
  /** Composição de resposta para perguntas de leitura sem rota determinística. */
  responder: NovaReadOnlyResponseProvider;
  enabled: (input: { userId: string; channel: 'WEB' }) => boolean;
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
    context: contextProvider,
    responder: novaReadOnlyResponseProvider,
    enabled: isNovaServerOrchestratorEnabledFor,
    now: () => new Date(),
    ownerId: () => `web:${randomUUID()}`,
  }) {}

  async process(input: ProcessMessageInput): Promise<NovaReadOnlyOrchestratorOutcome> {
    if (!this.dependencies.enabled({ userId: input.userId, channel: 'WEB' })) return { kind: 'DISABLED' };
    const conversation = await this.dependencies.persistence.findAccessibleActiveWebConversation(input);
    if (!conversation) return { kind: 'NOT_FOUND' };

    const now = this.dependencies.now();
    // Fronteira explícita: só os 3 campos persistíveis de NovaTurn atravessam
    // para o repository — nunca o `input` inteiro (que carrega `content`).
    const created = await this.dependencies.persistence.createOrReplayTurn({
      conversationId: input.conversationId,
      userId: input.userId,
      clientTurnId: input.clientTurnId,
    });
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
      // Contenção tem precedência ABSOLUTA (B4b). Antes desta correção, uma
      // referência resolvida vencia o roteamento — então uma frase de mutação
      // anafórica (`Cancele esse empréstimo`) com estado financeiro persistido
      // recuperava contexto por `fromState()` e era roteada como
      // FINANCIAL_STATUS, contornando `BLOCKED_MUTATION`. Nenhuma mutação
      // chegava a ser executada, porque este fluxo não tem caminho de
      // execução — mas a contenção declarada estava furada no roteamento, e
      // isso deixaria de ser inofensivo quando a execução existir.
      const blockedMutation = initialRoute.kind === 'BLOCKED_MUTATION';
      const route: NovaReadOnlyRoute = blockedMutation
        ? initialRoute
        : reference
          ? { kind: 'FINANCIAL_STATUS', focusCategory: reference.focusCategory }
          : initialRoute;
      const response = await this.respond({
        userId: input.userId,
        persona: conversation.persona,
        message: input.content,
        route,
        history: recentMessages,
      });
      // Mutação bloqueada também não disputa o estado semântico: a conversa
      // não mudou de foco por causa de um pedido recusado.
      const state = blockedMutation ? null : (reference ?? (route.kind === 'FINANCIAL_STATUS'
        ? { intentFamily: 'FINANCIAL_STATUS' as const, focusCategory: route.focusCategory, focusType: route.focusCategory ? 'CATEGORY' as const : 'SET' as const, setReference: route.focusCategory ?? 'OVERDUE_COMMITMENTS' }
        : null));
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
        // Turno sem referência financeira resolvida NÃO avança o estado
        // semântico. Sem isto, uma pergunta aberta entre dois follow-ups
        // gravaria `intentFamily: 'OPEN_QUESTION'` e `focusCategory: null`,
        // e como `fromState()` só recupera família `FINANCIAL_STATUS`, o
        // foco financeiro persistido seria destruído — regressão direta do
        // comportamento validado em produção nos Testes 2 e 4 do piloto.
        advanceSemanticState: state !== null,
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

  /**
   * As rotas determinísticas continuam determinísticas: `FINANCIAL_STATUS`,
   * `DAILY_OVERVIEW` e `BLOCKED_MUTATION` respondem exatamente como antes da
   * PR10.4, sem passar por nenhum modelo. Só `OPEN_QUESTION` compõe — e por
   * isso o contexto do usuário é buscado apenas nesse ramo, mantendo o custo
   * e a latência das rotas já validadas em produção inalterados.
   */
  private async respond(input: {
    userId: string;
    persona: NovaReadOnlyPersona;
    message: string;
    route: NovaReadOnlyRoute;
    history: readonly NovaReadOnlyPromptMessage[];
  }): Promise<string> {
    if (input.route.kind === 'FINANCIAL_STATUS') {
      return buildFinancialStatusReply(await this.dependencies.finances.getStatus(input.userId), input.route.focusCategory);
    }
    if (input.route.kind === 'DAILY_OVERVIEW') {
      return formatDailyOverviewReply(await this.dependencies.overview.getOverview(input.userId));
    }
    if (input.route.kind === 'BLOCKED_MUTATION') {
      return 'Essa operação não está disponível neste fluxo somente leitura. Nenhuma alteração foi realizada.';
    }
    const context = await this.dependencies.context.getUserContext(input.userId);
    return this.dependencies.responder.compose({
      persona: input.persona,
      message: input.message,
      context,
      history: input.history,
    });
  }
}

export const novaReadOnlyOrchestratorService = new NovaReadOnlyOrchestratorService();
