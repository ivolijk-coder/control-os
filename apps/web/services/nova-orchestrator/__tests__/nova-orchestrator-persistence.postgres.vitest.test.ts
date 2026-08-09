import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const enabled = process.env.RUN_NOVA_ORCHESTRATOR_POSTGRES_TESTS === '1' && Boolean(process.env.TEST_DATABASE_URL);

describe.runIf(enabled)('NovaOrchestrator persistence — PostgreSQL real', () => {
  const userId = 'a1010101-1010-4010-8010-101010101010';
  const otherUserId = 'a2020202-2020-4020-8020-202020202020';
  let conversationId = '';

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const { prisma } = await import('@/lib/prisma');
    await prisma.appUser.createMany({
      data: [
        { id: userId, name: 'Usuário PR10.2', email: 'pr10.2-owner@example.test', passwordHash: 'not-a-real-password' },
        { id: otherUserId, name: 'Outro PR10.2', email: 'pr10.2-other@example.test', passwordHash: 'not-a-real-password' },
      ],
      skipDuplicates: true,
    });
    const conversation = await prisma.novaConversation.create({
      data: {
        userId,
        channel: 'API',
        persona: 'NOVA',
        status: 'ACTIVE',
        activeKey: `pr10.2:${userId}`,
      },
    });
    conversationId = conversation.id;
  });

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma');
    await prisma.appUser.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await prisma.$disconnect();
  });

  it('creates one turn and grants only one concurrent lease', async () => {
    const { novaOrchestratorPersistence: repository } = await import('../nova-orchestrator-persistence.repository');
    const { prisma } = await import('@/lib/prisma');
    const results = await Promise.all(Array.from({ length: 8 }, () => repository.createOrReplayTurn({
      conversationId, userId, clientTurnId: 'pr10.2-concurrent-turn',
    })));
    const turnIds = results.map((result) => result?.turn.id);
    expect(new Set(turnIds).size).toBe(1);
    expect(await prisma.novaTurn.count({ where: { conversationId, clientTurnId: 'pr10.2-concurrent-turn' } })).toBe(1);

    const turn = results[0]!.turn;
    const claims = await Promise.all(Array.from({ length: 8 }, (_, index) => repository.claimTurn({
      turnId: turn.id,
      conversationId,
      userId,
      expectedVersion: turn.version,
      owner: `worker-${index}`,
      now: new Date('2026-08-09T12:00:00.000Z'),
    })));
    const winners = claims.filter(Boolean);
    expect(winners).toHaveLength(1);
    expect(winners[0]?.processingLeaseToken).toMatch(/^[0-9a-f-]{36}$/u);
    expect(winners[0]?.attemptCount).toBe(1);
  });

  it('recovers an expired lease and replays a completed turn without reprocessing', async () => {
    const { novaOrchestratorPersistence: repository } = await import('../nova-orchestrator-persistence.repository');
    const created = await repository.createOrReplayTurn({ conversationId, userId, clientTurnId: 'pr10.2-recovery' });
    const first = await repository.claimTurn({
      turnId: created!.turn.id, conversationId, userId, expectedVersion: created!.turn.version,
      owner: 'worker-dead', now: new Date('2026-08-09T13:00:00.000Z'), leaseMs: 1,
    });
    const replayExpired = await repository.replayTurn({
      turnId: first!.id, conversationId, userId, now: new Date('2026-08-09T13:00:01.000Z'),
    });
    expect(replayExpired?.kind).toBe('RECOVERABLE');
    const recovered = await repository.claimTurn({
      turnId: first!.id, conversationId, userId, expectedVersion: first!.version,
      owner: 'worker-recovery', now: new Date('2026-08-09T13:00:01.000Z'),
    });
    expect(recovered?.attemptCount).toBe(2);
    await expect(repository.completeTurnWithMessages({
      turnId: first!.id, conversationId, userId, expectedVersion: first!.version,
      owner: first!.processingOwner!, leaseToken: first!.processingLeaseToken!,
      now: new Date('2026-08-09T13:00:02.000Z'),
      user: { content: 'Processo antigo' }, assistant: { content: 'Não pode finalizar' },
    })).resolves.toBeNull();
    const completed = await repository.completeTurnWithMessages({
      turnId: recovered!.id, conversationId, userId, expectedVersion: recovered!.version,
      owner: recovered!.processingOwner!, leaseToken: recovered!.processingLeaseToken!,
      now: new Date('2026-08-09T13:00:02.000Z'),
      user: { content: 'Qual empréstimo está vencido?' },
      assistant: { content: 'Consultei seus dados atuais.' },
    });
    expect(completed?.status).toBe('COMPLETED');
    const replay = await repository.replayTurn({
      turnId: recovered!.id, conversationId, userId, now: new Date('2026-08-09T13:00:03.000Z'),
    });
    expect(replay?.kind).toBe('COMPLETED');
    if (replay?.kind === 'COMPLETED') expect(replay.messages.map((message) => message.role)).toEqual(['USER', 'ASSISTANT']);
  });

  it('protects confirmation claim/finalization/cancellation and expiration in the database', async () => {
    const { novaOrchestratorPersistence: repository } = await import('../nova-orchestrator-persistence.repository');
    const { prisma } = await import('@/lib/prisma');
    const now = new Date('2026-08-09T14:00:00.000Z');
    const created = await repository.createOrReplayTurn({ conversationId, userId, clientTurnId: 'pr10.2-confirmation' });
    const claimedTurn = await repository.claimTurn({
      turnId: created!.turn.id, conversationId, userId, expectedVersion: created!.turn.version, owner: 'planner', now,
    });
    const confirmation = await repository.createConfirmation({
      turnId: claimedTurn!.id,
      conversationId,
      userId,
      expectedTurnVersion: claimedTurn!.version,
      actionKind: 'expense.create',
      payload: { amount: 300, description: 'Mercado' },
      now,
    });
    expect(confirmation?.confirmation.validatedPayload).toEqual({ amount: 300, description: 'Mercado' });
    expect((await repository.replayTurn({
      turnId: claimedTurn!.id, conversationId, userId, now: new Date('2026-08-09T14:00:00.500Z'),
    }))?.kind).toBe('AWAITING_CONFIRMATION');
    const claims = await Promise.all(Array.from({ length: 8 }, (_, index) => repository.claimConfirmation({
      confirmationId: confirmation!.confirmation.id,
      conversationId,
      userId,
      expectedVersion: confirmation!.confirmation.version,
      owner: `confirmation-worker-${index}`,
      now: new Date('2026-08-09T14:00:01.000Z'),
    })));
    const winners = claims.filter(Boolean);
    expect(winners).toHaveLength(1);
    const winner = winners[0]!;
    const finalized = await Promise.all(Array.from({ length: 4 }, () => repository.finalizeConfirmation({
      confirmationId: winner.id,
      userId,
      expectedVersion: winner.version,
      owner: winner.claimOwner!,
      leaseToken: winner.claimLeaseToken!,
      now: new Date('2026-08-09T14:00:02.000Z'),
    })));
    expect(finalized.filter(Boolean)).toHaveLength(1);
    expect(finalized.find(Boolean)?.status).toBe('CONFIRMED');
    expect((await repository.cancelConfirmation({ confirmationId: winner.id, conversationId, userId, now }))?.status).toBe('CONFIRMED');

    const expiringTurn = await repository.createOrReplayTurn({ conversationId, userId, clientTurnId: 'pr10.2-expiry' });
    const expiringClaim = await repository.claimTurn({
      turnId: expiringTurn!.turn.id,
      conversationId,
      userId,
      expectedVersion: expiringTurn!.turn.version,
      owner: 'planner',
      now,
    });
    const expiring = await repository.createConfirmation({
      turnId: expiringClaim!.id, conversationId, userId, expectedTurnVersion: expiringClaim!.version,
      actionKind: 'expense.create', payload: { amount: 1, description: 'Expira' }, now,
    });
    const expired = await repository.findConfirmation({
      turnId: expiringClaim!.id, conversationId, userId,
      now: new Date(expiring!.confirmation.expiresAt.getTime() + 1),
    });
    expect(expired?.status).toBe('EXPIRED');
    expect((await repository.findConfirmation({
      turnId: expiringClaim!.id, conversationId, userId,
      now: new Date(expiring!.confirmation.expiresAt.getTime() + 2),
    }))?.status).toBe('EXPIRED');

    const cancelledTurn = await repository.createOrReplayTurn({ conversationId, userId, clientTurnId: 'pr10.2-cancel' });
    const cancelledClaim = await repository.claimTurn({
      turnId: cancelledTurn!.turn.id, conversationId, userId,
      expectedVersion: cancelledTurn!.turn.version, owner: 'planner', now,
    });
    const cancellable = await repository.createConfirmation({
      turnId: cancelledClaim!.id, conversationId, userId, expectedTurnVersion: cancelledClaim!.version,
      actionKind: 'expense.create', payload: { amount: 10, description: 'Cancelar' }, now,
    });
    const cancellations = await Promise.all(Array.from({ length: 8 }, () => repository.cancelConfirmation({
      confirmationId: cancellable!.confirmation.id, conversationId, userId, now,
    })));
    expect(cancellations.every((item) => item?.status === 'CANCELLED')).toBe(true);
    expect(await prisma.novaPendingConfirmation.count({ where: { turnId: cancelledClaim!.id } })).toBe(1);
  });

  it('enforces ownership, rolls back message persistence, and versions semantic state', async () => {
    const { novaOrchestratorPersistence: repository } = await import('../nova-orchestrator-persistence.repository');
    const { prisma } = await import('@/lib/prisma');
    await expect(repository.createOrReplayTurn({ conversationId, userId: otherUserId, clientTurnId: 'foreign' })).resolves.toBeNull();

    const now = new Date('2026-08-09T15:00:00.000Z');
    const stateTurn = await repository.createOrReplayTurn({ conversationId, userId, clientTurnId: 'pr10.2-state' });
    const stateCreates = await Promise.all([
      repository.compareAndSetSemanticState({
        conversationId, userId, intentFamily: 'FINANCIAL_STATUS', focusCategory: 'OVERDUE', focusType: 'LOAN',
        focusReference: { kind: 'ENTITY', entityId: 'contract-reference', entityType: 'LOAN' },
        sourceTurnId: stateTurn!.turn.id, expectedVersion: null, now,
      }),
      repository.compareAndSetSemanticState({
        conversationId, userId, intentFamily: 'OTHER', focusCategory: null, focusType: null,
        focusReference: null, sourceTurnId: stateTurn!.turn.id, expectedVersion: null, now,
      }),
    ]);
    expect(stateCreates.filter(Boolean)).toHaveLength(1);
    expect(await prisma.novaConversationState.count({ where: { conversationId } })).toBe(1);
    const state = await repository.getSemanticState({ conversationId, userId, now });
    expect(state).not.toBeNull();
    expect(await repository.compareAndSetSemanticState({
      conversationId, userId, intentFamily: 'FINANCIAL_STATUS', focusCategory: 'OVERDUE', focusType: 'LOAN',
      focusReference: { kind: 'RELATIVE', relation: 'PREVIOUS' }, sourceTurnId: stateTurn!.turn.id,
      expectedVersion: state!.version + 1, now,
    })).toBe(false);

    const rollbackTurn = await repository.createOrReplayTurn({ conversationId, userId, clientTurnId: 'pr10.2-rollback' });
    const rollbackClaim = await repository.claimTurn({
      turnId: rollbackTurn!.turn.id,
      conversationId,
      userId,
      expectedVersion: rollbackTurn!.turn.version,
      owner: 'worker',
      now,
    });
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION reject_pr102_assistant() RETURNS trigger AS $$
      BEGIN
        IF NEW.role = 'ASSISTANT' AND NEW.correlation_id = '${rollbackTurn!.turn.id}' THEN
          RAISE EXCEPTION 'synthetic assistant failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER reject_pr102_assistant_trigger
      BEFORE INSERT ON nova_messages
      FOR EACH ROW EXECUTE FUNCTION reject_pr102_assistant()
    `);
    try {
      await expect(repository.completeTurnWithMessages({
        turnId: rollbackTurn!.turn.id, conversationId, userId, expectedVersion: rollbackClaim!.version,
        owner: rollbackClaim!.processingOwner!, leaseToken: rollbackClaim!.processingLeaseToken!, now,
        user: { content: 'Deve sofrer rollback' }, assistant: { content: 'Falha sintética' },
      })).rejects.toThrow();
      expect(await prisma.novaMessage.count({ where: { correlationId: rollbackTurn!.turn.id } })).toBe(0);
      expect((await prisma.novaTurn.findUniqueOrThrow({ where: { id: rollbackTurn!.turn.id } })).status).toBe('PROCESSING');
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS reject_pr102_assistant_trigger ON nova_messages');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS reject_pr102_assistant()');
    }

    const orphanTurn = await repository.createOrReplayTurn({ conversationId, userId, clientTurnId: 'pr10.2-orphan-rollback' });
    const orphanClaim = await repository.claimTurn({
      turnId: orphanTurn!.turn.id, conversationId, userId,
      expectedVersion: orphanTurn!.turn.version, owner: 'planner', now,
    });
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION reject_pr102_confirmation() RETURNS trigger AS $$
      BEGIN
        IF NEW.action_kind = 'category.create' THEN
          RAISE EXCEPTION 'synthetic confirmation failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER reject_pr102_confirmation_trigger
      BEFORE INSERT ON nova_pending_confirmations
      FOR EACH ROW EXECUTE FUNCTION reject_pr102_confirmation()
    `);
    try {
      await expect(repository.createConfirmation({
        turnId: orphanClaim!.id, conversationId, userId, expectedTurnVersion: orphanClaim!.version,
        actionKind: 'category.create', payload: { name: 'Teste' }, now,
      })).rejects.toThrow();
      expect(await prisma.novaPendingConfirmation.count({ where: { turnId: orphanClaim!.id } })).toBe(0);
      expect((await prisma.novaTurn.findUniqueOrThrow({ where: { id: orphanClaim!.id } })).status).toBe('PROCESSING');
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS reject_pr102_confirmation_trigger ON nova_pending_confirmations');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS reject_pr102_confirmation()');
    }

    const isolatedConversation = await prisma.novaConversation.create({
      data: { userId, channel: 'API', persona: 'LEGENDARY', status: 'CLOSED' },
    });
    await expect(repository.claimTurn({
      turnId: stateTurn!.turn.id,
      conversationId: isolatedConversation.id,
      userId,
      expectedVersion: stateTurn!.turn.version,
      owner: 'wrong-conversation',
      now,
    })).resolves.toBeNull();
    const deletedConversation = await prisma.novaConversation.create({
      data: { userId, channel: 'APP', persona: 'NOVA', status: 'CLOSED', deletedAt: now },
    });
    const deletedTurn = await prisma.novaTurn.create({
      data: { conversationId: deletedConversation.id, userId, clientTurnId: 'deleted-conversation-turn' },
    });
    await expect(repository.replayTurn({
      turnId: deletedTurn.id, conversationId: deletedConversation.id, userId, now,
    })).resolves.toBeNull();
  });
});
