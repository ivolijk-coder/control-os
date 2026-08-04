import { describe, expect, it, vi } from 'vitest';
import { parseAmount, parseIntent } from '../intent/parser';
import { CreateFinancingAction, CreateLoanAction } from '@/services/action-engine/actions/finance/create-financial-contract.action';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';
import type { FinancialContract } from '@/services/finance-contracts';

function contract(type: 'LOAN' | 'FINANCING'): FinancialContract {
  return {
    id: 'contract-1', userId: 'user-1', name: 'Contrato', institution: 'Nubank', type,
    origin: 'PERSONAL', categoryId: null, accountId: null, totalAmount: 9000,
    financedAmount: null, installmentAmount: 300, totalInstallments: 30,
    paidInstallments: 0, dueDay: 10, startDate: '2026-08-10T00:00:00.000Z',
    endDate: null, interestRate: null, status: 'ACTIVE', source: 'NOVA',
    documentId: null, createdAt: '2026-08-02T00:00:00.000Z', updatedAt: '2026-08-02T00:00:00.000Z',
  };
}

describe('PR6 — intents de contratos financeiros', () => {
  it('preserva formatos monetários existentes e valores com quatro dígitos', () => {
    expect(parseAmount('R$ 3600')).toBe(3600);
    expect(parseAmount('R$ 12.50')).toBe(12.5);
    expect(parseAmount('R$ 2.500,50')).toBe(2500.5);
  });

  it('reconhece empréstimo antes de compra parcelada', () => {
    expect(parseIntent('Nubank 30x300 valor 9 mil empréstimo para pagar contas, vencimento dia 10')).toMatchObject({
      kind: 'criar_emprestimo', institution: 'Nubank', totalAmount: 9000,
      installments: 30, installmentAmount: 300, dueDay: 10,
    });
  });

  it('reconhece financiamento sem confundir com dívida genérica', () => {
    expect(parseIntent('Financiamento de veículo, total 48000 em 48 vezes, vencimento dia 20')).toMatchObject({
      kind: 'criar_financiamento', totalAmount: 48000, installments: 48, dueDay: 20,
    });
  });

  it('preserva compra parcelada no fluxo installment.create', () => {
    expect(parseIntent('Parcelar notebook de 3600 em 12x')).toMatchObject({
      kind: 'parcelar_despesa', totalAmount: 3600, installments: 12,
    });
  });

  it('não cria intent executável enquanto faltar vencimento', () => {
    expect(parseIntent('Nubank 30x300 valor 9 mil empréstimo')).toEqual({
      kind: 'desconhecido', raw: 'Nubank 30x300 valor 9 mil empréstimo',
    });
  });
});

describe('PR6 — actions de contratos protegidas', () => {
  const metadata = { operationId: 'message-123', channel: 'web' as const };
  const payload = {
    institution: 'Nubank', totalAmount: 9000, installments: 30,
    installmentAmount: 300, dueDay: 10, description: 'Empréstimo para pagar contas',
  };

  it('mantém criação bloqueada por padrão e não chama o serviço', async () => {
    const create = vi.fn();
    const result = await new CreateLoanAction(create, () => false).execute(payload);
    expect(result.success).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('fixa userId, source e tipo LOAN fora do payload do modelo', async () => {
    const create = vi.fn().mockResolvedValue(contract('LOAN'));
    const result = await runAsFinanceUser('user-1', () => new CreateLoanAction(create, () => true).execute({
      ...payload, userId: 'attacker', source: 'MANUAL', type: 'FINANCING',
    }, metadata));
    expect(result.success).toBe(true);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', source: 'NOVA', type: 'LOAN', idempotencyKey: expect.stringMatching(/^contract:v1:/) }));
  });

  it('fixa FINANCING no handler de financiamento', async () => {
    const create = vi.fn().mockResolvedValue(contract('FINANCING'));
    await runAsFinanceUser('user-1', () => new CreateFinancingAction(create, () => true).execute(payload, metadata));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ type: 'FINANCING' }));
  });
});
