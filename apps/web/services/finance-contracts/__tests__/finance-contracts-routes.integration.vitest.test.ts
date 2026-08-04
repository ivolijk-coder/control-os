import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Rotas HTTP da evolução "Parcelas & Empréstimos" (Fase 2). Mesmo padrão de
 * `services/conversation-tasks/__tests__/conversation-tasks-routes.
 * integration.vitest.test.ts`: mocka a camada de serviço (já coberta por
 * `financial-contract.service.unit.vitest.test.ts`) e prova que a ROTA
 * chega até ela com o `userId` certo (sempre da sessão, nunca do corpo da
 * requisição) e mapeia status/erros corretamente. Vive em
 * `services/finance-contracts/__tests__` — não junto das rotas em `app/api`
 * — porque `vitest.config.ts` só inclui os diretórios `services` e `tests`.
 *
 * Rotas de pagamento/estorno (`/api/finance/installments/:id/pay` e
 * `/undo-pay`) têm seu próprio arquivo,
 * `finance-installments-routes.integration.vitest.test.ts` — nasceram num
 * commit separado ("payment and reversal flow").
 */

let currentUserId: string | null;
const createFinancialContract = vi.fn();
const listFinancialContracts = vi.fn();
const getFinancialContract = vi.fn();
const getFinancialDashboard = vi.fn();
const settleFinancialContract = vi.fn();

vi.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}));
vi.mock('@/services/auth/session', () => ({
  currentSessionUserId: vi.fn(() => currentUserId ?? undefined),
}));
vi.mock('@/services/modules/finance/finance-user-context', () => ({
  runAsFinanceUser: vi.fn(async (_userId: string, operation: () => unknown) => operation()),
}));
// `vi.importActual` abaixo carrega o módulo de verdade (só pra reaproveitar
// a classe real `FinancialContractError` nos `instanceof` das rotas) — o
// que executa as importações transitivas de `financial-contract.service.ts`
// (`server-only`, `@/lib/prisma`, `@/services/modules`, `@/services/
// repositories`). Precisam de mock aqui pelo mesmo motivo de
// `conversation-tasks-routes.integration.vitest.test.ts`: geração do
// Prisma Client bloqueada neste sandbox.
vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/services/modules', () => ({ PersistentFinanceService: class {} }));
vi.mock('@/services/repositories', () => ({ PrismaFinanceRepository: class {} }));
vi.mock('@/services/finance-contracts', async () => {
  const actual = await vi.importActual<typeof import('@/services/finance-contracts')>('@/services/finance-contracts');
  return { ...actual, createFinancialContract, listFinancialContracts, getFinancialContract, getFinancialDashboard, settleFinancialContract };
});

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/x', { method: 'POST', headers: { 'Idempotency-Key': 'operation-test-1' }, body: JSON.stringify(body) });
}

const PRONAMPE_INPUT = { name: 'Pronampe Santander', institution: 'Santander', type: 'LOAN', totalAmount: 252000, installmentAmount: 6000, totalInstallments: 42, dueDay: 24 };

describe('GET/POST /api/finance/contracts', () => {
  beforeEach(() => {
    currentUserId = 'user-a';
    createFinancialContract.mockReset();
    listFinancialContracts.mockReset();
  });

  it('GET exige sessão', async () => {
    currentUserId = null;
    const { GET } = await import('@/app/api/finance/contracts/route');
    const response = await GET();
    expect(response.status).toBe(401);
    expect(listFinancialContracts).not.toHaveBeenCalled();
  });

  it('GET repassa o userId da sessão, nunca de fora', async () => {
    listFinancialContracts.mockResolvedValue([{ id: 'contract-a' }]);
    const { GET } = await import('@/app/api/finance/contracts/route');
    const response = await GET();
    expect(response.status).toBe(200);
    expect(listFinancialContracts).toHaveBeenCalledWith('user-a');
    expect((response.body as unknown as { contracts: unknown[] }).contracts).toEqual([{ id: 'contract-a' }]);
  });

  it('POST 400 quando faltam campos obrigatórios (nunca chama o service)', async () => {
    const { POST } = await import('@/app/api/finance/contracts/route');
    const response = await POST(jsonRequest({ name: '', type: 'LOAN' }));
    expect(response.status).toBe(400);
    expect(createFinancialContract).not.toHaveBeenCalled();
  });

  it('POST exige identidade idempotente fora do body', async () => {
    const { POST } = await import('@/app/api/finance/contracts/route');
    const response = await POST(new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(PRONAMPE_INPUT) }));
    expect(response.status).toBe(400);
    expect(createFinancialContract).not.toHaveBeenCalled();
  });

  it('POST 400 para tipo de contrato inválido', async () => {
    const { POST } = await import('@/app/api/finance/contracts/route');
    const response = await POST(jsonRequest({ ...PRONAMPE_INPUT, type: 'BITCOIN' }));
    expect(response.status).toBe(400);
    expect(createFinancialContract).not.toHaveBeenCalled();
  });

  it('POST 201 e repassa os campos pro service com o userId da sessão (exemplo Pronampe do script)', async () => {
    createFinancialContract.mockResolvedValue({ id: 'contract-a', name: 'Pronampe Santander', totalInstallments: 42 });
    const { POST } = await import('@/app/api/finance/contracts/route');
    const response = await POST(jsonRequest(PRONAMPE_INPUT));

    expect(response.status).toBe(201);
    expect(createFinancialContract).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-a', name: 'Pronampe Santander', type: 'LOAN', totalAmount: 252000, installmentAmount: 6000, totalInstallments: 42, dueDay: 24, source: 'MANUAL', idempotencyKey: expect.stringMatching(/^contract:v1:/) })
    );
  });

  it('POST ignora source/documentId sensíveis enviados pelo cliente', async () => {
    createFinancialContract.mockResolvedValue({ id: 'contract-a' });
    const { POST } = await import('@/app/api/finance/contracts/route');
    await POST(jsonRequest({ ...PRONAMPE_INPUT, source: 'NOVA', documentId: '00000000-0000-4000-8000-000000000099' }));
    expect(createFinancialContract).toHaveBeenCalledWith(expect.objectContaining({ source: 'MANUAL' }));
    expect(createFinancialContract.mock.calls[0]?.[0]).not.toHaveProperty('documentId');
  });

  it('POST mapeia FinancialContractError pro status HTTP correto', async () => {
    const { FinancialContractError } = await vi.importActual<typeof import('@/services/finance-contracts')>('@/services/finance-contracts');
    createFinancialContract.mockRejectedValue(new FinancialContractError(422, 'O valor da parcela informado é incompatível com o valor total do contrato.'));
    const { POST } = await import('@/app/api/finance/contracts/route');
    const response = await POST(jsonRequest(PRONAMPE_INPUT));
    expect(response.status).toBe(422);
    expect((response.body as unknown as { message: string }).message).toContain('incompatível');
  });
});

describe('GET /api/finance/contracts/:id', () => {
  beforeEach(() => {
    currentUserId = 'user-a';
    getFinancialContract.mockReset();
  });

  it('404 quando o contrato não existe (ou é de outro usuário)', async () => {
    getFinancialContract.mockResolvedValue(undefined);
    const { GET } = await import('@/app/api/finance/contracts/[id]/route');
    const response = await GET(new Request('http://localhost/x'), { params: { id: 'contract-x' } });
    expect(response.status).toBe(404);
  });

  it('200 com o contrato quando encontrado', async () => {
    getFinancialContract.mockResolvedValue({ id: 'contract-a' });
    const { GET } = await import('@/app/api/finance/contracts/[id]/route');
    const response = await GET(new Request('http://localhost/x'), { params: { id: 'contract-a' } });
    expect(response.status).toBe(200);
    expect(getFinancialContract).toHaveBeenCalledWith('user-a', 'contract-a');
  });

  it('200 inclui "summary" ao lado de "contract" (Fase 3, "contract detail" — aditivo, nunca troca a chave existente)', async () => {
    getFinancialContract.mockResolvedValue({
      id: 'contract-a',
      totalAmount: 300,
      installments: [
        { id: 'i1', number: 1, amount: 100, status: 'PAID', dueDate: '2026-07-01T00:00:00.000Z' },
        { id: 'i2', number: 2, amount: 200, status: 'PENDING', dueDate: '2026-09-01T00:00:00.000Z' },
      ],
    });
    const { GET } = await import('@/app/api/finance/contracts/[id]/route');
    const response = await GET(new Request('http://localhost/x'), { params: { id: 'contract-a' } });
    expect(response.status).toBe(200);
    const body = response.body as unknown as { contract: { id: string }; summary: { totalAmount: number; paidAmount: number; remainingAmount: number } };
    expect(body.contract.id).toBe('contract-a');
    expect(body.summary).toMatchObject({ totalAmount: 300, paidAmount: 100, remainingAmount: 200 });
  });
});

describe('POST /api/finance/contracts/:id/settle', () => {
  beforeEach(() => {
    currentUserId = 'user-a';
    settleFinancialContract.mockReset();
  });

  it('exige sessão', async () => {
    currentUserId = null;
    const { POST } = await import('@/app/api/finance/contracts/[id]/settle/route');
    const response = await POST(jsonRequest({}), { params: { id: 'contract-a' } });
    expect(response.status).toBe(401);
    expect(settleFinancialContract).not.toHaveBeenCalled();
  });

  it('200 e repassa contractId + userId da sessão (nunca do corpo)', async () => {
    settleFinancialContract.mockResolvedValue({ contract: { id: 'contract-a', status: 'PAID_OFF' }, cancelledInstallments: [] });
    const { POST } = await import('@/app/api/finance/contracts/[id]/settle/route');
    const response = await POST(jsonRequest({}), { params: { id: 'contract-a' } });
    expect(response.status).toBe(200);
    expect(settleFinancialContract).toHaveBeenCalledWith({ userId: 'user-a', contractId: 'contract-a', settledAt: undefined, source: 'manual' });
    expect((response.body as unknown as { contract: { status: string } }).contract.status).toBe('PAID_OFF');
  });

  it('400 quando settledAt informado é inválido (nunca chama o service)', async () => {
    const { POST } = await import('@/app/api/finance/contracts/[id]/settle/route');
    const response = await POST(jsonRequest({ settledAt: 'não é uma data' }), { params: { id: 'contract-a' } });
    expect(response.status).toBe(400);
    expect(settleFinancialContract).not.toHaveBeenCalled();
  });

  it('mapeia FinancialContractError pro status HTTP correto (ex.: contrato já quitado)', async () => {
    const { FinancialContractError } = await vi.importActual<typeof import('@/services/finance-contracts')>('@/services/finance-contracts');
    settleFinancialContract.mockRejectedValue(new FinancialContractError(422, 'Este contrato já está quitado.'));
    const { POST } = await import('@/app/api/finance/contracts/[id]/settle/route');
    const response = await POST(jsonRequest({}), { params: { id: 'contract-a' } });
    expect(response.status).toBe(422);
    expect((response.body as unknown as { message: string }).message).toContain('quitado');
  });
});

describe('GET /api/finance/contracts/dashboard', () => {
  it('repassa o userId da sessão', async () => {
    currentUserId = 'user-a';
    getFinancialDashboard.mockResolvedValue({ outstandingBalance: { count: 0, total: 0 } });
    const { GET } = await import('@/app/api/finance/contracts/dashboard/route');
    const response = await GET();
    expect(response.status).toBe(200);
    expect(getFinancialDashboard).toHaveBeenCalledWith('user-a');
  });
});
