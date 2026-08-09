import { describe, expect, it } from 'vitest';
import {
  completedResult,
  defineTurnIdentity,
  failedResult,
  logicalTurnKey,
  processingResult,
  type NovaConversationSemanticState,
  type NovaOrchestratorResultDTO,
  type NovaPendingConfirmation,
  type ReferenceResolutionRequest,
} from '..';

describe('contratos do ConversationOrchestrator', () => {
  const identity = defineTurnIdentity({
    turnId: 'turn-1', conversationId: 'conversation-1', clientTurnId: 'client-1', userId: 'user-1', channel: 'WEB', persona: 'NOVA',
  });

  it('preserva separação entre usuário, conversa, persona e canal', () => {
    expect(identity).toEqual({
      turnId: 'turn-1', conversationId: 'conversation-1', clientTurnId: 'client-1', userId: 'user-1', channel: 'WEB', persona: 'NOVA',
    });
    expect(Object.isFrozen(identity)).toBe(true);
  });

  it('rejeita identidade incompleta', () => {
    expect(() => defineTurnIdentity({ ...identity, userId: ' ' })).toThrow('userId é obrigatório');
  });

  it('formaliza replay por conversationId + clientTurnId', () => {
    expect(logicalTurnKey(identity)).toBe('conversation-1\u0000client-1');
    expect(logicalTurnKey({ ...identity, clientTurnId: 'client-2' })).not.toBe(logicalTurnKey(identity));
  });

  it('estado semântico contém referente, não valores financeiros mutáveis', () => {
    const state: NovaConversationSemanticState = {
      conversationId: identity.conversationId,
      userId: identity.userId,
      intentFamily: 'FINANCIAL_STATUS',
      focusCategory: 'LOAN',
      focusType: 'FINANCIAL_CONTRACT',
      focusReference: { kind: 'ENTITY', entityId: 'contract-1', entityType: 'FINANCIAL_CONTRACT' },
      sourceTurnId: identity.turnId,
      version: 1,
      expiresAt: new Date('2026-08-09T13:00:00.000Z'),
      updatedAt: new Date('2026-08-09T12:00:00.000Z'),
    };
    expect(Object.keys(state)).not.toEqual(expect.arrayContaining(['balance', 'amount', 'overdueAmount', 'installmentValue']));
  });

  it('reference resolution recebe histórico e estado, mas exige consulta canônica posterior', () => {
    const request: ReferenceResolutionRequest = {
      identity,
      message: 'Quanto falta?',
      semanticState: null,
      recentMessages: [{ role: 'USER', content: 'Tenho empréstimos em atraso?', intent: 'FINANCIAL_STATUS' }],
    };
    expect(request.message).toBe('Quanto falta?');
    expect(request).not.toHaveProperty('financialValue');
  });

  it('separa plano interno de confirmação do preview público', () => {
    const internal: NovaPendingConfirmation = {
      confirmationId: 'confirmation-1', turnId: identity.turnId, conversationId: identity.conversationId,
      userId: identity.userId, version: 1, status: 'PENDING', preview: 'Confirma esta ação?',
      validatedActions: [{ kind: 'expense.create', payload: { amount: 100 } }],
      expiresAt: new Date('2026-08-09T13:00:00.000Z'), createdAt: new Date('2026-08-09T12:00:00.000Z'),
    };
    const publicResult: NovaOrchestratorResultDTO = {
      status: 'AWAITING_CONFIRMATION', turnId: identity.turnId, messages: [],
      confirmation: {
        confirmationId: internal.confirmationId, version: internal.version, preview: internal.preview,
        expiresAt: internal.expiresAt.toISOString(),
      },
    };
    expect(publicResult.confirmation).not.toHaveProperty('validatedActions');
    expect(JSON.stringify(publicResult)).not.toContain('amount');
  });

  it('DTOs públicos não carregam detalhes internos', () => {
    const results = [
      completedResult(identity.turnId, []),
      processingResult(identity.turnId),
      failedResult(identity.turnId, 'UNAVAILABLE', 'Não foi possível concluir agora.'),
    ];
    for (const result of results) {
      expect(result).not.toHaveProperty('prisma');
      expect(result).not.toHaveProperty('rawOpenAIResponse');
      expect(result).not.toHaveProperty('toolPayload');
      expect(result).not.toHaveProperty('idempotencyKey');
      expect(result).not.toHaveProperty('stack');
    }
  });
});
