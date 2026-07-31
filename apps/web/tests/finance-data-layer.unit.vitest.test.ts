import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import {
  FinanceApiClient,
  FinanceApiError,
  serializeFinanceTransactionFilters,
} from '@/lib/finance/finance-api-client';
import { invalidateFinanceTransactionQueries } from '@/lib/finance/finance-hooks';
import { financeKeys } from '@/lib/finance/finance-query-keys';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('cliente HTTP financeiro', () => {
  it('invoca o fetch nativo sem vinculá-lo à instância do cliente', async () => {
    let receiver: unknown;
    vi.stubGlobal('fetch', function (this: unknown) {
      receiver = this;
      return Promise.resolve(json({
        success: true,
        dashboard: {},
        fixedAccounts: {},
      }));
    });

    try {
      const client = new FinanceApiClient();
      await client.getDashboard();
      expect(receiver).not.toBe(client);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('serializa filtros em ordem estável e preserva cursor opaco', () => {
    expect(serializeFinanceTransactionFilters({
      sort: 'date_asc',
      search: 'almoço & mercado',
      cursor: 'eyJpZCI6IjEifQ==',
      limit: 20,
      status: 'pendente',
      accountId: 'account-id',
      competenceFrom: '2030-01-01',
    })).toBe(
      'cursor=eyJpZCI6IjEifQ%3D%3D&limit=20&status=pendente&accountId=account-id&competenceFrom=2030-01-01&search=almo%C3%A7o+%26+mercado&sort=date_asc'
    );
  });

  it('constrói a URL paginada e encaminha AbortSignal', async () => {
    const signal = new AbortController().signal;
    const fetcher = vi.fn(async () => json({
      success: true,
      items: [],
      nextCursor: 'next-page',
      hasMore: true,
    }));
    const client = new FinanceApiClient(fetcher);

    await expect(client.listTransactions({ limit: 10, cursor: 'current' }, signal)).resolves.toEqual({
      items: [],
      nextCursor: 'next-page',
      hasMore: true,
    });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/finance/transactions?cursor=current&limit=10',
      { signal }
    );
  });

  it('normaliza falha HTTP em FinanceApiError', async () => {
    const client = new FinanceApiClient(async () => json({
      success: false,
      message: 'Cursor inválido.',
      code: 'invalid_cursor',
    }, 400));

    const error = await client.listTransactions({ cursor: 'bad' }).catch((cause) => cause);
    expect(error).toBeInstanceOf(FinanceApiError);
    expect(error).toMatchObject({
      message: 'Cursor inválido.',
      code: 'invalid_cursor',
      status: 400,
    });
  });

  it('normaliza rede e resposta inválida sem esconder cancelamento', async () => {
    const networkClient = new FinanceApiClient(async () => {
      throw new Error('socket');
    });
    await expect(networkClient.getDashboard()).rejects.toMatchObject({
      code: 'network_error',
      status: 0,
    });

    const invalidClient = new FinanceApiClient(async () => new Response('not-json', { status: 502 }));
    await expect(invalidClient.getDashboard()).rejects.toMatchObject({
      code: 'invalid_response',
      status: 502,
    });

    const abort = new DOMException('Aborted', 'AbortError');
    const abortedClient = new FinanceApiClient(async () => {
      throw abort;
    });
    await expect(abortedClient.getDashboard()).rejects.toBe(abort);
  });

  it('envia idempotência na criação e ações tipadas no PATCH', async () => {
    const fetcher = vi.fn(async () => json({ success: true, message: 'ok' }));
    const client = new FinanceApiClient(fetcher);

    await client.createTransaction({
      type: 'despesa',
      amount: 2500,
      description: 'Internet',
      idempotencyKey: 'stable-key',
    });
    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/finance/transactions', expect.objectContaining({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'stable-key',
      },
      body: JSON.stringify({ type: 'despesa', amount: 2500, description: 'Internet' }),
    }));

    await client.reverseTransaction('transaction-id');
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/finance/transactions/transaction-id', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ action: 'reverse' }),
    }));
  });
});

describe('query keys financeiras', () => {
  it('mantém hierarquia, escopo e estabilidade dos filtros', () => {
    expect(financeKeys.dashboard()).toEqual(['finance', 'dashboard']);
    expect(financeKeys.transaction('tx-1')).toEqual(['finance', 'transactions', 'detail', 'tx-1']);
    expect(financeKeys.accountList(true)).toEqual(['finance', 'accounts', { includeArchived: true }]);
    expect(financeKeys.categoryList()).toEqual(['finance', 'categories', { includeArchived: false }]);
    expect(financeKeys.transactionList({ status: 'pendente', limit: 20 })).toEqual(
      financeKeys.transactionList({ limit: 20, status: 'pendente' })
    );
  });

  it('invalida dashboard, todas as listas, contas e o detalhe afetado', async () => {
    const client = new QueryClient();
    const listKey = financeKeys.transactionList({ status: 'pendente' });
    const accountKey = financeKeys.accountList(true);
    const detailKey = financeKeys.transaction('tx-1');
    client.setQueryData(financeKeys.dashboard(), {});
    client.setQueryData(listKey, {});
    client.setQueryData(accountKey, {});
    client.setQueryData(detailKey, {});

    await invalidateFinanceTransactionQueries(client, 'tx-1');

    expect(client.getQueryState(financeKeys.dashboard())?.isInvalidated).toBe(true);
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(accountKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(detailKey)?.isInvalidated).toBe(true);
  });
});
