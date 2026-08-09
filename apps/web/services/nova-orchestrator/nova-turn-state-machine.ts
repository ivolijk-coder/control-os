import { NovaOrchestratorError } from './nova-orchestrator.errors';
import type { NovaProcessingLease, NovaTurnSnapshot, NovaTurnStatus } from './nova-orchestrator.types';

const VALID_TRANSITIONS: Readonly<Record<NovaTurnStatus, readonly NovaTurnStatus[]>> = {
  RECEIVED: ['PROCESSING', 'CANCELLED', 'FAILED'],
  PROCESSING: ['AWAITING_CONFIRMATION', 'COMPLETED', 'FAILED', 'CANCELLED'],
  AWAITING_CONFIRMATION: ['EXECUTING', 'CANCELLED', 'FAILED'],
  EXECUTING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function isTerminalTurnStatus(status: NovaTurnStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}

export function canTransitionTurn(from: NovaTurnStatus, to: NovaTurnStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function transitionTurn(turn: NovaTurnSnapshot, to: NovaTurnStatus, at: Date): NovaTurnSnapshot {
  if (!canTransitionTurn(turn.status, to)) {
    throw new NovaOrchestratorError(
      'INVALID_TURN_TRANSITION',
      `Transição de turno não permitida: ${turn.status} -> ${to}.`
    );
  }
  return { ...turn, status: to, version: turn.version + 1, lease: null, updatedAt: at };
}

export function isLeaseExpired(lease: NovaProcessingLease, now: Date): boolean {
  return lease.expiresAt.getTime() <= now.getTime();
}

export function canClaimTurn(turn: NovaTurnSnapshot, now: Date): boolean {
  if (turn.status === 'RECEIVED') return turn.lease === null || isLeaseExpired(turn.lease, now);
  if (turn.status === 'PROCESSING' || turn.status === 'EXECUTING') {
    return turn.lease !== null && isLeaseExpired(turn.lease, now);
  }
  return false;
}

export function claimTurn(
  turn: NovaTurnSnapshot,
  input: { ownerId: string; now: Date; expiresAt: Date }
): NovaTurnSnapshot {
  if (!input.ownerId.trim() || input.expiresAt.getTime() <= input.now.getTime()) {
    throw new NovaOrchestratorError('INVALID_LEASE', 'Lease de processamento inválido.');
  }
  if (!canClaimTurn(turn, input.now)) {
    throw new NovaOrchestratorError('TURN_ALREADY_PROCESSING', 'O turno não está disponível para processamento.');
  }

  const status = turn.status === 'RECEIVED' ? 'PROCESSING' : turn.status;
  return {
    ...turn,
    status,
    version: turn.version + 1,
    lease: {
      ownerId: input.ownerId,
      claimedAt: input.now,
      expiresAt: input.expiresAt,
      attempt: (turn.lease?.attempt ?? 0) + 1,
    },
    updatedAt: input.now,
  };
}

export function canRecoverTurn(turn: NovaTurnSnapshot, now: Date): boolean {
  return (turn.status === 'PROCESSING' || turn.status === 'EXECUTING')
    && turn.lease !== null
    && isLeaseExpired(turn.lease, now);
}

export const novaTurnTransitions = VALID_TRANSITIONS;
