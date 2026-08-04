import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FinancialStatusDTO } from '../financial-intelligence.types';

const mocks = vi.hoisted(() => ({
  userId: 'user-a' as string | undefined,
  getStatus: vi.fn(),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}));

vi.mock('@/services/auth/session', () => ({
  currentSessionUserId: () => mocks.userId,
}));

vi.mock('@/services/financial-intelligence/financial-intelligence.sources', () => ({
  financialIntelligenceService: { getStatus: mocks.getStatus },
}));

const STATUS_DTO: FinancialStatusDTO = {
  referenceDate: '2026-08-10T00:00:00.000Z',
  totalOverdue: 300,
  overdueCount: 1,
  categories: [{
    type: 'FIXED_ACCOUNT',
    count: 1,
    total: 300,
    items: [{
      id: 'occurrence-1',
      source: 'FIXED_ACCOUNTS',
      sourceType: 'FIXED_ACCOUNT',
      title: 'Condomínio',
      amount: 300,
      dueDate: '2026-08-05T00:00:00.000Z',
      status: 'OVERDUE',
      daysOverdue: 5,
    }],
  }],
  upcomingCommitments: [],
  availableBalance: 5000,
  projectedBalance: 4700,
  projectionHorizonDays: 30,
  dataCoverage: [
    { source: 'TRANSACTIONS', status: 'AVAILABLE' },
    { source: 'ACCOUNTS', status: 'AVAILABLE' },
    { source: 'FIXED_ACCOUNTS', status: 'AVAILABLE' },
    { source: 'FINANCIAL_CONTRACTS', status: 'AVAILABLE' },
    { source: 'CARDS', status: 'NOT_IMPLEMENTED' },
  ],
  generatedAt: '2026-08-10T00:00:01.000Z',
};

describe('GET /api/finance/intelligence/status', () => {
  beforeEach(() => {
    mocks.userId = 'user-a';
    mocks.getStatus.mockReset();
    mocks.getStatus.mockResolvedValue(STATUS_DTO);
  });

  it('retorna 401 sem sessão e não consulta a camada financeira', async () => {
    mocks.userId = undefined;
    const { GET } = await import('@/app/api/finance/intelligence/status/route');
    const response = await GET();

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ success: false, message: 'Faça login para consultar sua situação financeira.' });
    expect(mocks.getStatus).not.toHaveBeenCalled();
  });

  it('retorna o FinancialStatusDTO para o usuário autenticado', async () => {
    const { GET } = await import('@/app/api/finance/intelligence/status/route');
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.getStatus).toHaveBeenCalledWith('user-a');
    expect(response.body).toEqual({ success: true, status: STATUS_DTO });
  });

  it('isola chamadas sucessivas usando somente o usuário da sessão', async () => {
    const { GET } = await import('@/app/api/finance/intelligence/status/route');
    await GET();
    mocks.userId = 'user-b';
    await GET();

    expect(mocks.getStatus).toHaveBeenNthCalledWith(1, 'user-a');
    expect(mocks.getStatus).toHaveBeenNthCalledWith(2, 'user-b');
  });

  it('ignora userId enviado por query ou header', async () => {
    const request = new Request('http://localhost/api/finance/intelligence/status?userId=attacker', {
      method: 'GET',
      headers: { 'x-user-id': 'attacker' },
    });
    const { GET } = await import('@/app/api/finance/intelligence/status/route');
    const invokeWithUntrustedRequest = GET as unknown as (untrusted: Request) => ReturnType<typeof GET>;
    await invokeWithUntrustedRequest(request);

    expect(mocks.getStatus).toHaveBeenCalledOnce();
    expect(mocks.getStatus).toHaveBeenCalledWith('user-a');
    expect(mocks.getStatus).not.toHaveBeenCalledWith('attacker');
  });

  it('trata erro interno sem expor mensagem ou stack', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.getStatus.mockRejectedValue(new Error('postgres://secret@internal:5432/control'));
    const { GET } = await import('@/app/api/finance/intelligence/status/route');
    const response = await GET();

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ success: false, message: 'Não foi possível consultar sua situação financeira agora.' });
    expect(JSON.stringify(response.body)).not.toContain('postgres');
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it('preserva o contrato completo da resposta financeira', async () => {
    const { GET } = await import('@/app/api/finance/intelligence/status/route');
    const response = await GET();
    const body = response.body as unknown as { success: true; status: FinancialStatusDTO };

    expect(body.status).toMatchObject({
      referenceDate: expect.any(String),
      totalOverdue: expect.any(Number),
      overdueCount: expect.any(Number),
      categories: expect.any(Array),
      upcomingCommitments: expect.any(Array),
      availableBalance: expect.any(Number),
      projectionHorizonDays: expect.any(Number),
      dataCoverage: expect.any(Array),
      generatedAt: expect.any(String),
    });
    expect(body.status).toHaveProperty('projectedBalance');
    expect(body.status.dataCoverage.map((item) => item.source)).toEqual([
      'TRANSACTIONS', 'ACCOUNTS', 'FIXED_ACCOUNTS', 'FINANCIAL_CONTRACTS', 'CARDS',
    ]);
  });
});
