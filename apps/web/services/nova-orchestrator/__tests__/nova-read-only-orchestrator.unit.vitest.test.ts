import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isNovaServerOrchestratorEnabled } from '../nova-orchestrator-persistence.config';
import { resolveReadOnlyFinancialReference } from '../nova-reference-resolver';
import { routeNovaReadOnlyMessage } from '../nova-read-only-routing';

describe('PR10.3 — roteamento e referências read-only', () => {
  it('mantém a flag estrita e desligada por padrão', () => {
    expect(isNovaServerOrchestratorEnabled({})).toBe(false);
    expect(isNovaServerOrchestratorEnabled({ NOVA_SERVER_ORCHESTRATOR_ENABLED: 'TRUE' })).toBe(false);
    expect(isNovaServerOrchestratorEnabled({ NOVA_SERVER_ORCHESTRATOR_ENABLED: 'true' })).toBe(true);
  });

  it('roteia fontes reais e bloqueia mutações sem executar action', () => {
    expect(routeNovaReadOnlyMessage('Tenho empréstimos em atraso?')).toEqual({ kind: 'FINANCIAL_STATUS', focusCategory: 'LOAN' });
    expect(routeNovaReadOnlyMessage('Resumo de tudo hoje')).toEqual({ kind: 'DAILY_OVERVIEW' });
    expect(routeNovaReadOnlyMessage('Cadastre uma despesa de 100 reais')).toEqual({ kind: 'BLOCKED_MUTATION' });
  });

  it('resolve elipse por estado semântico sem armazenar valores financeiros', () => {
    const result = resolveReadOnlyFinancialReference({
      message: 'Quanto?',
      semanticState: {
        conversationId: 'conversation', userId: 'user', intentFamily: 'FINANCIAL_STATUS',
        focusCategory: 'LOAN', focusType: 'CATEGORY',
        focusReference: { kind: 'SET', setReference: 'LOAN', entityType: 'LOAN' },
        sourceTurnId: 'turn', version: 1, expiresAt: new Date(Date.now() + 1000), updatedAt: new Date(),
      },
      recentMessages: [],
    });
    expect(result).toEqual({ intentFamily: 'FINANCIAL_STATUS', focusCategory: 'LOAN', focusType: 'CATEGORY', setReference: 'LOAN' });
    expect(JSON.stringify(result)).not.toMatch(/3600|amount|balance/u);
  });

  it('reconstrói referência a partir do histórico USER persistido', () => {
    const result = resolveReadOnlyFinancialReference({
      message: 'E o outro?', semanticState: null,
      recentMessages: [
        { role: 'ASSISTANT', content: 'R$ 3.600', intent: 'FINANCIAL_STATUS' },
        { role: 'USER', content: 'Tenho financiamentos vencidos?', intent: 'FINANCIAL_STATUS' },
      ],
    });
    expect(result?.focusCategory).toBe('FINANCING');
  });
});
