import { describe, expect, it } from 'vitest';
import {
  NOVA_TURN_STATUSES,
  canClaimTurn,
  canRecoverTurn,
  canTransitionTurn,
  claimTurn,
  isTerminalTurnStatus,
  novaTurnTransitions,
  transitionTurn,
  type NovaTurnSnapshot,
} from '..';

const now = new Date('2026-08-09T12:00:00.000Z');

function turn(status: NovaTurnSnapshot['status'], lease: NovaTurnSnapshot['lease'] = null): NovaTurnSnapshot {
  return {
    identity: {
      turnId: 'turn-1', conversationId: 'conversation-1', clientTurnId: 'client-1', userId: 'user-1', channel: 'WEB', persona: 'NOVA',
    },
    operation: { correlationId: 'correlation-1', operationId: 'operation-1', receivedAt: now },
    status,
    version: 1,
    lease,
    createdAt: now,
    updatedAt: now,
  };
}

describe('máquina de estados do ConversationOrchestrator', () => {
  it('aceita exatamente todas as transições declaradas', () => {
    for (const from of NOVA_TURN_STATUSES) {
      for (const to of NOVA_TURN_STATUSES) {
        expect(canTransitionTurn(from, to)).toBe(novaTurnTransitions[from].includes(to));
      }
    }
  });

  it.each([
    ['RECEIVED', 'PROCESSING'],
    ['PROCESSING', 'COMPLETED'],
    ['PROCESSING', 'AWAITING_CONFIRMATION'],
    ['AWAITING_CONFIRMATION', 'EXECUTING'],
    ['AWAITING_CONFIRMATION', 'CANCELLED'],
    ['EXECUTING', 'COMPLETED'],
  ] as const)('permite %s -> %s', (from, to) => {
    expect(transitionTurn(turn(from), to, now).status).toBe(to);
  });

  it.each(['COMPLETED', 'FAILED', 'CANCELLED'] as const)('mantém %s terminal', (status) => {
    expect(isTerminalTurnStatus(status)).toBe(true);
    for (const target of NOVA_TURN_STATUSES) expect(canTransitionTurn(status, target)).toBe(false);
  });

  it('rejeita retorno arbitrário ao processamento', () => {
    expect(() => transitionTurn(turn('COMPLETED'), 'PROCESSING', now)).toThrow('Transição de turno não permitida');
    expect(() => transitionTurn(turn('CANCELLED'), 'PROCESSING', now)).toThrow('Transição de turno não permitida');
  });

  it('modela claim inicial sem banco ou Redis', () => {
    const claimed = claimTurn(turn('RECEIVED'), {
      ownerId: 'worker-1', now, expiresAt: new Date('2026-08-09T12:00:30.000Z'),
    });
    expect(claimed.status).toBe('PROCESSING');
    expect(claimed.lease).toMatchObject({ ownerId: 'worker-1', attempt: 1 });
  });

  it('só permite recovery após expiração do lease', () => {
    const active = turn('PROCESSING', {
      ownerId: 'worker-1', claimedAt: now, expiresAt: new Date('2026-08-09T12:00:30.000Z'), attempt: 1,
    });
    const expired = turn('PROCESSING', {
      ownerId: 'worker-1', claimedAt: now, expiresAt: new Date('2026-08-09T11:59:59.000Z'), attempt: 1,
    });
    expect(canClaimTurn(active, now)).toBe(false);
    expect(canRecoverTurn(active, now)).toBe(false);
    expect(canClaimTurn(expired, now)).toBe(true);
    expect(canRecoverTurn(expired, now)).toBe(true);
    expect(claimTurn(expired, { ownerId: 'worker-2', now, expiresAt: new Date('2026-08-09T12:00:30.000Z') }).lease?.attempt).toBe(2);
  });
});
