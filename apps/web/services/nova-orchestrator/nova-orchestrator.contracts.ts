import { NovaOrchestratorError } from './nova-orchestrator.errors';
import type {
  NovaOrchestratorResultDTO,
  NovaPublicMessageDTO,
  NovaTurnIdentity,
} from './nova-orchestrator.types';

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new NovaOrchestratorError('INVALID_TURN_IDENTITY', `${field} é obrigatório.`);
  return normalized;
}

export function defineTurnIdentity(identity: NovaTurnIdentity): NovaTurnIdentity {
  return Object.freeze({
    ...identity,
    turnId: required(identity.turnId, 'turnId'),
    conversationId: required(identity.conversationId, 'conversationId'),
    clientTurnId: required(identity.clientTurnId, 'clientTurnId'),
    userId: required(identity.userId, 'userId'),
  });
}

/** Identificador lógico de replay; não é uma chave financeira nem vem do modelo. */
export function logicalTurnKey(identity: Pick<NovaTurnIdentity, 'conversationId' | 'clientTurnId'>): string {
  return `${required(identity.conversationId, 'conversationId')}\u0000${required(identity.clientTurnId, 'clientTurnId')}`;
}

export function completedResult(turnId: string, messages: readonly NovaPublicMessageDTO[]): NovaOrchestratorResultDTO {
  return { status: 'COMPLETED', turnId: required(turnId, 'turnId'), messages: [...messages] };
}

export function processingResult(turnId: string): NovaOrchestratorResultDTO {
  return { status: 'PROCESSING', turnId: required(turnId, 'turnId') };
}

export function failedResult(turnId: string, code: string, message: string): NovaOrchestratorResultDTO {
  return {
    status: 'FAILED',
    turnId: required(turnId, 'turnId'),
    error: { code: required(code, 'code'), message: required(message, 'message') },
  };
}
