import { beforeEach, describe, expect, it, vi } from 'vitest';

let userId: string | undefined;
const execute = vi.fn();

vi.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}));
vi.mock('@/services/auth/session', () => ({ currentSessionUserId: () => userId }));
vi.mock('@/services/action-engine', () => ({ actionRegistry: { execute } }));

function request(body: unknown): Request {
  return new Request('http://localhost/api/finance/actions', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/finance/actions — contratos NOVA', () => {
  beforeEach(() => {
    userId = '00000000-0000-4000-8000-000000000061';
    execute.mockReset();
    execute.mockResolvedValue([{ success: true, message: 'Contrato criado.' }]);
  });

  it('exige sessão', async () => {
    userId = undefined;
    const { POST } = await import('@/app/api/finance/actions/route');
    const response = await POST(request({ kind: 'loan.create', payload: {}, operationId: 'message-1' }) as never);
    expect(response.status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });

  it('exige operationId fora do payload para contratos', async () => {
    const { POST } = await import('@/app/api/finance/actions/route');
    const response = await POST(request({ kind: 'loan.create', payload: { operationId: 'model-controlled' } }) as never);
    expect(response.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it('remove campos sensíveis do modelo e entrega metadata separada', async () => {
    const { POST } = await import('@/app/api/finance/actions/route');
    const response = await POST(request({
      kind: 'loan.create',
      operationId: 'message-1',
      payload: {
        description: 'Empréstimo', totalAmount: 9000, installments: 30, dueDay: 10,
        userId: 'attacker', type: 'FINANCING', source: 'MANUAL', idempotencyKey: 'attacker-key',
        idempotencyFingerprint: 'attacker-fingerprint', documentId: '00000000-0000-4000-8000-000000000099',
      },
    }) as never);
    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledWith(
      [{ kind: 'loan.create', payload: { description: 'Empréstimo', totalAmount: 9000, installments: 30, dueDay: 10, source: 'nova' } }],
      userId,
      { operationId: 'message-1', channel: 'web' },
    );
  });

  it('propaga conflito idempotente como HTTP 409', async () => {
    execute.mockResolvedValue([{ success: false, message: 'Conflito.', status: 409 }]);
    const { POST } = await import('@/app/api/finance/actions/route');
    const response = await POST(request({ kind: 'financing.create', payload: {}, operationId: 'message-2' }) as never);
    expect(response.status).toBe(409);
  });
});
