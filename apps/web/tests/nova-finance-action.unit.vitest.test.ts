import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreateExpenseAction } from '@/services/ai/actions/create-expense-action';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NOVA — criação de despesa persistente', () => {
  it('encaminha conta e categoria informadas ao mesmo endpoint financeiro', async () => {
    const fetcher = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({
      success: true,
      message: 'Despesa registrada.',
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);

    const results = await new CreateExpenseAction({
      amount: 300,
      description: 'Mercado',
      accountName: 'Conta principal',
      category: 'Alimentação',
    }).execute({} as never);

    expect(results).toEqual([
      expect.objectContaining({ ok: true, detail: 'Despesa registrada.' }),
    ]);
    const [, init] = fetcher.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      kind: 'expense.create',
      origin: 'nova',
      payload: expect.objectContaining({
        amount: 300,
        description: 'Mercado',
        accountName: 'Conta principal',
        category: 'Alimentação',
      }),
    });
  });

  it('mantém Alimentação como padrão sem inventar uma conta', async () => {
    const fetcher = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({
      success: false,
      message: 'Selecione uma conta bancária ativa antes de registrar a movimentação.',
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);

    const results = await new CreateExpenseAction({ amount: 300, description: 'Mercado' }).execute({} as never);

    expect(results[0]).toEqual(expect.objectContaining({
      ok: false,
      detail: 'Selecione uma conta bancária ativa antes de registrar a movimentação.',
    }));
    const [, init] = fetcher.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      kind: 'expense.create',
      origin: 'nova',
      payload: expect.objectContaining({
        categoryId: 'default:Alimentação',
      }),
    });
  });
});
