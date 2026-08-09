import { describe, expect, it } from 'vitest';
import {
  NovaConfirmationPayloadError,
  validateNovaConfirmationPayload,
} from '../nova-confirmation-payload.schemas';
import { deriveNovaOperationId } from '../nova-operation-id';
import { validateNovaReferenceSelection } from '../nova-semantic-state.validation';

describe('NovaOrchestrator persistence contracts', () => {
  it('derives a stable server-side operation id without exposing the financial payload', () => {
    const first = deriveNovaOperationId('turn-1', 0);
    const replay = deriveNovaOperationId('turn-1', 0);
    const nextAction = deriveNovaOperationId('turn-1', 1);

    expect(first).toBe(replay);
    expect(first).not.toBe(nextAction);
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(first).not.toContain('turn-1');
  });

  it('accepts only the closed schema for a supported action', () => {
    expect(validateNovaConfirmationPayload('loan.create', {
      institution: ' Nubank ',
      totalAmount: 9000,
      installments: 30,
      dueDay: 5,
      description: ' Empréstimo para pagar contas ',
    })).toEqual({
      institution: 'Nubank',
      totalAmount: 9000,
      installments: 30,
      dueDay: 5,
      description: 'Empréstimo para pagar contas',
    });
  });

  it.each([
    ['unknown field', { totalAmount: 9000, installments: 30, dueDay: 5, description: 'Teste', extra: true }],
    ['identity', { totalAmount: 9000, installments: 30, dueDay: 5, description: 'Teste', userId: 'forged' }],
    ['secret', { totalAmount: 9000, installments: 30, dueDay: 5, description: 'Teste', apiKey: 'secret' }],
  ])('rejects %s in a confirmation payload', (_label, payload) => {
    expect(() => validateNovaConfirmationPayload('loan.create', payload)).toThrow(NovaConfirmationPayloadError);
  });

  it('rejects unsupported actions instead of persisting raw tool payloads', () => {
    expect(() => validateNovaConfirmationPayload('financial_status.get', {})).toThrow(NovaConfirmationPayloadError);
  });

  it('rejects credentials embedded in otherwise allowed string fields', () => {
    expect(() => validateNovaConfirmationPayload('expense.create', {
      amount: 100,
      description: 'api_key=super-secret-value',
    })).toThrow(NovaConfirmationPayloadError);
  });

  it('accepts semantic references and rejects mutable financial facts', () => {
    expect(validateNovaReferenceSelection({ kind: 'ENTITY', entityId: 'contract-1', entityType: 'LOAN' }))
      .toEqual({ kind: 'ENTITY', entityId: 'contract-1', entityType: 'LOAN' });
    expect(() => validateNovaReferenceSelection({
      kind: 'ENTITY', entityId: 'contract-1', entityType: 'LOAN', amount: 3600,
    })).toThrow('Referência semântica inválida.');
    expect(() => validateNovaReferenceSelection({
      kind: 'SET', setReference: 'overdue-loans', entityType: 'LOAN', balance: 100,
    })).toThrow('Referência semântica inválida.');
  });
});
