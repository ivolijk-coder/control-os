import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  isNovaServerOrchestratorEnabled,
  isNovaServerOrchestratorEnabledFor,
  parseNovaServerOrchestratorWebUserAllowlist,
} from '../nova-orchestrator-persistence.config';
import { resolveReadOnlyFinancialReference } from '../nova-reference-resolver';
import { routeNovaReadOnlyMessage } from '../nova-read-only-routing';

describe('PR10.3 — roteamento e referências read-only', () => {
  it('mantém a flag estrita e desligada por padrão', () => {
    expect(isNovaServerOrchestratorEnabled({})).toBe(false);
    expect(isNovaServerOrchestratorEnabled({ NOVA_SERVER_ORCHESTRATOR_ENABLED: 'TRUE' })).toBe(false);
    expect(isNovaServerOrchestratorEnabled({ NOVA_SERVER_ORCHESTRATOR_ENABLED: 'true' })).toBe(true);
  });

  it('habilita somente userId persistido autorizado no canal WEB', () => {
    const allowed = '11111111-1111-4111-8111-111111111111';
    const environment = {
      NOVA_SERVER_ORCHESTRATOR_ENABLED: 'true',
      NOVA_SERVER_ORCHESTRATOR_WEB_USER_ALLOWLIST: allowed,
    };
    expect(isNovaServerOrchestratorEnabledFor({ userId: allowed, channel: 'WEB' }, environment)).toBe(true);
    expect(isNovaServerOrchestratorEnabledFor({ userId: '22222222-2222-4222-8222-222222222222', channel: 'WEB' }, environment)).toBe(false);
    expect(isNovaServerOrchestratorEnabledFor({ userId: allowed, channel: 'WHATSAPP' }, environment)).toBe(false);
  });

  it('falha fechado com flag falsa, allowlist vazia ou qualquer item malformado', () => {
    const allowed = '11111111-1111-4111-8111-111111111111';
    expect(isNovaServerOrchestratorEnabledFor({ userId: allowed, channel: 'WEB' }, {
      NOVA_SERVER_ORCHESTRATOR_ENABLED: 'false',
      NOVA_SERVER_ORCHESTRATOR_WEB_USER_ALLOWLIST: allowed,
    })).toBe(false);
    expect(isNovaServerOrchestratorEnabledFor({ userId: allowed, channel: 'WEB' }, {
      NOVA_SERVER_ORCHESTRATOR_ENABLED: 'true',
      NOVA_SERVER_ORCHESTRATOR_WEB_USER_ALLOWLIST: '',
    })).toBe(false);
    expect(parseNovaServerOrchestratorWebUserAllowlist(`${allowed},not-a-user-id`).size).toBe(0);
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
