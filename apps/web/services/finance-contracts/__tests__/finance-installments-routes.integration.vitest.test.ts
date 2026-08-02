import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Rotas de pagamento/estorno de parcela ("payment and reversal flow").
 * Mesmo padrão de `finance-contracts-routes.integration.vitest.test.ts`:
 * mocka a camada de serviço (já coberta por
 * `financial-contract.service.unit.vitest.test.ts`, que por sua vez chama
 * `PersistentFinanceService.createExpense`/`reverseTransaction` — nunca
 * cria `Transaction` diretamente, nunca toca `installmentGroupId`) e prova
 * que a ROTA chega até ela com o `userId` certo (sempre da sessão) e mapeia
 * status/erros corretamente.
 */

let currentUserId: string | null;
const payFinancialInstallment = vi.fn();
const undoFinancialInstallmentPayment = vi.fn();

vi.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}));
vi.mock('@/services/auth/session', () => ({
  currentSessionUserId: vi.fn(() => currentUserId ?? undefined),
}));
vi.mock('@/services/modules/finance/finance-user-context', () => ({
  runAsFinanceUser: vi.fn(async (_userId: string, operation: () => unknown) => operation()),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/services/modules', () => ({ PersistentFinanceService: class {} }));
vi.mock('@/services/repositories', () => ({ PrismaFinanceRepository: class {} }));
vi.mock('@/services/finance-contracts', async () => {
  const actual = await vi.importActual<typeof import('@/services/finance-contracts')>('@/services/finance-contracts');
  return { ...actual, payFinancialInstallment, undoFinancialInstallmentPayment };
});

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/finance/installments/:id/pay e /undo-pay', () => {
  beforeEach(() => {
    currentUserId = 'user-a';
    payFinancialInstallment.mockReset();
    undoFinancialInstallmentPayment.mockReset();
  });

  it('pay: 200 e repassa installmentId + userId da sessão', async () => {
    payFinancialInstallment.mockResolvedValue({ alreadyPaid: false, installment: { id: 'installment-a', status: 'PAID' } });
    const { POST } = await import('@/app/api/finance/installments/[id]/pay/route');
    const response = await POST(jsonRequest({ paidAt: '2026-08-02' }), { params: { id: 'installment-a' } });
    expect(response.status).toBe(200);
    expect(payFinancialInstallment).toHaveBeenCalledWith({ userId: 'user-a', installmentId: 'installment-a', paidAt: '2026-08-02', source: 'manual' });
  });

  it('pay exige sessão', async () => {
    currentUserId = null;
    const { POST } = await import('@/app/api/finance/installments/[id]/pay/route');
    const response = await POST(jsonRequest({}), { params: { id: 'installment-a' } });
    expect(response.status).toBe(401);
    expect(payFinancialInstallment).not.toHaveBeenCalled();
  });

  it('pay: 400 quando paidAt informado é inválido (nunca chama o service)', async () => {
    const { POST } = await import('@/app/api/finance/installments/[id]/pay/route');
    const response = await POST(jsonRequest({ paidAt: 'não é uma data' }), { params: { id: 'installment-a' } });
    expect(response.status).toBe(400);
    expect(payFinancialInstallment).not.toHaveBeenCalled();
  });

  it('pay: mapeia FinancialContractError (ex.: 409 de reserva concorrente)', async () => {
    const { FinancialContractError } = await vi.importActual<typeof import('@/services/finance-contracts')>('@/services/finance-contracts');
    payFinancialInstallment.mockRejectedValue(new FinancialContractError(409, 'Esta parcela já está sendo paga em outra requisição.'));
    const { POST } = await import('@/app/api/finance/installments/[id]/pay/route');
    const response = await POST(jsonRequest({}), { params: { id: 'installment-a' } });
    expect(response.status).toBe(409);
  });

  it('undo-pay: 200 e repassa installmentId + userId da sessão', async () => {
    undoFinancialInstallmentPayment.mockResolvedValue({ installment: { id: 'installment-a', status: 'PENDING' } });
    const { POST } = await import('@/app/api/finance/installments/[id]/undo-pay/route');
    const response = await POST(new Request('http://localhost/x', { method: 'POST' }), { params: { id: 'installment-a' } });
    expect(response.status).toBe(200);
    expect(undoFinancialInstallmentPayment).toHaveBeenCalledWith({ userId: 'user-a', installmentId: 'installment-a', source: 'manual' });
  });

  it('undo-pay exige sessão', async () => {
    currentUserId = null;
    const { POST } = await import('@/app/api/finance/installments/[id]/undo-pay/route');
    const response = await POST(new Request('http://localhost/x', { method: 'POST' }), { params: { id: 'installment-a' } });
    expect(response.status).toBe(401);
    expect(undoFinancialInstallmentPayment).not.toHaveBeenCalled();
  });

  it('undo-pay: mapeia FinancialContractError pro status HTTP correto', async () => {
    const { FinancialContractError } = await vi.importActual<typeof import('@/services/finance-contracts')>('@/services/finance-contracts');
    undoFinancialInstallmentPayment.mockRejectedValue(new FinancialContractError(422, 'Esta parcela ainda não foi paga.'));
    const { POST } = await import('@/app/api/finance/installments/[id]/undo-pay/route');
    const response = await POST(new Request('http://localhost/x', { method: 'POST' }), { params: { id: 'installment-a' } });
    expect(response.status).toBe(422);
  });
});
