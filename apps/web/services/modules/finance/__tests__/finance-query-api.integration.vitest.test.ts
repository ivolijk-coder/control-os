import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceQueryError } from '../finance-query';

const mocks = vi.hoisted(() => ({
  userId: 'api-user' as string | undefined,
  list: vi.fn(),
  detail: vi.fn(),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}));

vi.mock('@/services/auth/session', () => ({
  currentSessionUserId: () => mocks.userId,
}));

vi.mock('@/services/modules/finance/finance-user-context', () => ({
  runAsFinanceUser: async (_userId: string, operation: () => unknown) => operation(),
}));

vi.mock('@/services/modules', () => ({
  financeService: {
    listTransactionsPaginated: mocks.list,
    getTransactionById: mocks.detail,
  },
}));

function request(query = ''): NextRequest {
  return { nextUrl: new URL(`http://localhost/api/finance/transactions${query}`) } as NextRequest;
}

describe('API financeira paginada', () => {
  beforeEach(() => {
    mocks.userId = 'api-user';
    mocks.list.mockReset();
    mocks.detail.mockReset();
  });

  it('exige sessão e nunca chama o serviço sem usuário', async () => {
    mocks.userId = undefined;
    const { GET } = await import('@/app/api/finance/transactions/route');
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('encaminha o contrato completo e retorna a página real', async () => {
    const accountId = '11111111-1111-4111-8111-111111111111';
    const categoryId = '22222222-2222-4222-8222-222222222222';
    const transactionId = '33333333-3333-4333-8333-333333333333';
    mocks.list.mockResolvedValue({ items: [{ id: transactionId }], nextCursor: 'next', hasMore: true });
    const { GET } = await import('@/app/api/finance/transactions/route');
    const response = await GET(request(`?limit=10&type=despesa&status=pendente&accountId=${accountId}&categoryId=${categoryId}&origin=nova&competenceFrom=2030-01-01&competenceTo=2030-01-31&dueDateFrom=2030-02-01&dueDateTo=2030-02-28&search=mercado&sort=date_asc`));
    expect(response.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith({
      cursor: undefined,
      limit: 10,
      type: 'despesa',
      status: 'pendente',
      accountId,
      categoryId,
      origin: 'nova',
      competenceFrom: '2030-01-01',
      competenceTo: '2030-01-31',
      dueDateFrom: '2030-02-01',
      dueDateTo: '2030-02-28',
      search: 'mercado',
      sort: 'date_asc',
    });
    expect(response.body).toEqual({ success: true, items: [{ id: transactionId }], nextCursor: 'next', hasMore: true });
  });

  it('rejeita enum inválido antes do serviço e converte erro de consulta em 400', async () => {
    const { GET } = await import('@/app/api/finance/transactions/route');
    expect((await GET(request('?status=qualquer'))).status).toBe(400);
    mocks.list.mockRejectedValue(new FinanceQueryError('Cursor inválido.', 'invalid_cursor'));
    expect((await GET(request('?cursor=ruim'))).status).toBe(400);
  });
});

describe('API de detalhe financeiro', () => {
  beforeEach(() => {
    mocks.userId = 'api-user';
    mocks.detail.mockReset();
  });

  it('retorna o DTO individual pelo FinanceService', async () => {
    const transactionId = '33333333-3333-4333-8333-333333333333';
    mocks.detail.mockResolvedValue({ id: transactionId, description: 'Real' });
    const { GET } = await import('@/app/api/finance/transactions/[id]/route');
    const response = await GET(request(), { params: { id: transactionId } });
    expect(response.status).toBe(200);
    expect(mocks.detail).toHaveBeenCalledWith(transactionId);
    expect(response.body).toEqual({ success: true, transaction: { id: transactionId, description: 'Real' } });
  });

  it('usa o mesmo 404 seguro para inexistente ou inacessível', async () => {
    mocks.detail.mockRejectedValue(new FinanceQueryError('Transação não encontrada.', 'not_found'));
    const { GET } = await import('@/app/api/finance/transactions/[id]/route');
    const response = await GET(request(), { params: { id: '44444444-4444-4444-8444-444444444444' } });
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ success: false, message: 'Transação não encontrada.' });
  });
});
