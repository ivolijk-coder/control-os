import { beforeEach, describe, expect, it, vi } from 'vitest';

const postFinanceAction = vi.fn();
vi.mock('../../finance-bridge', () => ({ postFinanceAction }));

describe('CreateLoanAction — identidade operacional', () => {
  beforeEach(() => postFinanceAction.mockReset());

  it('reutiliza o mesmo operationId em retries da mesma action', async () => {
    postFinanceAction.mockResolvedValue({ success: false, message: 'Timeout.' });
    const { CreateLoanAction } = await import('../create-financial-contract-action');
    const action = new CreateLoanAction({ totalAmount: 9000, installments: 30, installmentAmount: 300, dueDay: 10, description: 'Empréstimo Nubank' });
    await action.execute({} as never);
    await action.execute({} as never);
    const firstMetadata = postFinanceAction.mock.calls[0]?.[2];
    const secondMetadata = postFinanceAction.mock.calls[1]?.[2];
    expect(firstMetadata).toEqual(secondMetadata);
    expect(firstMetadata?.operationId).toBeTruthy();
  });

  it('mantém empréstimo e financiamento em actions distintas', async () => {
    postFinanceAction.mockResolvedValue({ success: true, message: 'Persistido.' });
    const { CreateFinancingAction, CreateLoanAction } = await import('../create-financial-contract-action');
    const input = { totalAmount: 9000, installments: 30, dueDay: 10, description: 'Contrato' };
    await new CreateLoanAction(input).execute({} as never);
    await new CreateFinancingAction(input).execute({} as never);
    expect(postFinanceAction.mock.calls[0]?.[0]).toBe('loan.create');
    expect(postFinanceAction.mock.calls[1]?.[0]).toBe('financing.create');
  });
});
