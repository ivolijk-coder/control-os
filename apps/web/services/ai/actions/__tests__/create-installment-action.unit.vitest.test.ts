import { beforeEach, describe, expect, it, vi } from 'vitest';

const postFinanceAction = vi.fn();
vi.mock('../../finance-bridge', () => ({ postFinanceAction }));

describe('CreateInstallmentAction', () => {
  beforeEach(() => postFinanceAction.mockReset());

  it('só confirma sucesso depois que a persistência conclui', async () => {
    postFinanceAction.mockResolvedValue({ success: true, message: 'Persistido.' });
    const { CreateInstallmentAction } = await import('../create-installment-action');
    const result = await new CreateInstallmentAction({ totalAmount: 1200, installments: 12, description: 'Notebook' }).execute({} as never);
    expect(postFinanceAction).toHaveBeenCalledOnce();
    expect(result[0]).toMatchObject({ ok: true, detail: 'Notebook em 12x' });
  });

  it('propaga a falha real e nunca devolve falso sucesso', async () => {
    postFinanceAction.mockResolvedValue({ success: false, message: 'Banco indisponível.' });
    const { CreateInstallmentAction } = await import('../create-installment-action');
    const result = await new CreateInstallmentAction({ totalAmount: 1200, installments: 12, description: 'Notebook' }).execute({} as never);
    expect(result[0]).toMatchObject({ ok: false, detail: 'Banco indisponível.' });
  });
});
