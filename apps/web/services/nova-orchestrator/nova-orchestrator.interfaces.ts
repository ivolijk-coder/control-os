import type { ActionEngine, ActionExecutionMetadata, ActionRequest, ActionResult, DecisionEngine } from '@/services/control-hub';
import type { ContextProvider, UserContext } from '@/services/context-provider';
import type { CapabilityRegistry } from '@/services/decision-engine';
import type { NovaConversation, NovaMessage } from '@/services/nova-conversations';
import type {
  NovaConversationSemanticState,
  NovaOrchestratorResultDTO,
  NovaPendingConfirmation,
  NovaProcessingLease,
  NovaPublicMessageDTO,
  NovaTurnIdentity,
  NovaTurnOperationMetadata,
  NovaTurnSnapshot,
  NovaTurnStatus,
  ReferenceResolution,
  ReferenceResolutionRequest,
} from './nova-orchestrator.types';

export interface ConversationStore {
  findAccessibleConversation(identity: Pick<NovaTurnIdentity, 'conversationId' | 'userId' | 'channel' | 'persona'>): Promise<NovaConversation | null>;
  listRecentMessages(identity: Pick<NovaTurnIdentity, 'conversationId' | 'userId'>, limit: number): Promise<readonly NovaMessage[]>;
  persistCompletedTurn(input: {
    identity: NovaTurnIdentity;
    userMessage: NovaPublicMessageDTO;
    assistantMessage: NovaPublicMessageDTO;
  }): Promise<void>;
}

export interface TurnStore {
  findByLogicalIdentity(identity: Pick<NovaTurnIdentity, 'conversationId' | 'clientTurnId' | 'userId'>): Promise<NovaTurnSnapshot | null>;
  createReceived(identity: NovaTurnIdentity, operation: NovaTurnOperationMetadata): Promise<NovaTurnSnapshot>;
  claim(input: { identity: NovaTurnIdentity; expectedVersion: number; lease: NovaProcessingLease }): Promise<NovaTurnSnapshot | null>;
  transition(input: { identity: NovaTurnIdentity; expectedVersion: number; to: NovaTurnStatus; at: Date }): Promise<NovaTurnSnapshot | null>;
  storePublicResult(input: { identity: NovaTurnIdentity; expectedVersion: number; result: NovaOrchestratorResultDTO }): Promise<NovaTurnSnapshot>;
}

export interface ConversationStateStore {
  get(identity: Pick<NovaTurnIdentity, 'conversationId' | 'userId'>): Promise<NovaConversationSemanticState | null>;
  compareAndSet(input: { state: NovaConversationSemanticState; expectedVersion: number | null }): Promise<boolean>;
  clear(identity: Pick<NovaTurnIdentity, 'conversationId' | 'userId'>): Promise<void>;
}

export interface PendingConfirmationStore {
  create(confirmation: NovaPendingConfirmation): Promise<NovaPendingConfirmation>;
  findAccessible(input: { confirmationId: string; turnId: string; conversationId: string; userId: string }): Promise<NovaPendingConfirmation | null>;
  claim(input: { confirmationId: string; userId: string; expectedVersion: number; at: Date }): Promise<NovaPendingConfirmation | null>;
  cancel(input: { confirmationId: string; userId: string; expectedVersion: number; at: Date }): Promise<NovaPendingConfirmation | null>;
}

export interface ReferenceResolver {
  resolve(request: ReferenceResolutionRequest): Promise<ReferenceResolution>;
}

/** Reusa o ContextProvider real já aprovado; não cria uma segunda fonte de contexto. */
export type OrchestratorContextProvider = ContextProvider;

/** Reusa o DecisionEngine oficial do Control Hub. */
export type OrchestratorDecisionProvider = DecisionEngine;

/** Reusa o mesmo catálogo que alimenta o Action Registry. */
export type OrchestratorCapabilityResolver = CapabilityRegistry;

/** Reusa o executor oficial; implementações não idempotentes ficam indisponíveis no rollout inicial. */
export type OrchestratorActionExecutor = ActionEngine;

export interface ResponseProvider {
  compose(input: {
    identity: NovaTurnIdentity;
    context: UserContext;
    userMessage: string;
    actionRequests: readonly ActionRequest[];
    actionResults: readonly ActionResult[];
  }): Promise<{ content: string; provider: string | null; providerResponseId: string | null }>;
}

export interface Clock {
  now(): Date;
}

export interface OperationIdFactory {
  create(identity: NovaTurnIdentity): ActionExecutionMetadata;
}

export interface ConversationOrchestratorPorts {
  readonly conversations: ConversationStore;
  readonly turns: TurnStore;
  readonly conversationState: ConversationStateStore;
  readonly confirmations: PendingConfirmationStore;
  readonly contextProvider: OrchestratorContextProvider;
  readonly referenceResolver: ReferenceResolver;
  readonly decisionProvider: OrchestratorDecisionProvider;
  readonly capabilityResolver: OrchestratorCapabilityResolver;
  readonly actionExecutor: OrchestratorActionExecutor;
  readonly responseProvider: ResponseProvider;
  readonly clock: Clock;
  readonly operationIdFactory: OperationIdFactory;
}
