import { beforeEach, describe, expect, it, vi } from 'vitest';

type ProposalState = 'READY_FOR_REVIEW' | 'PROCESSING' | 'CONFIRMED';

let proposalState: ProposalState;
let financeEffects: number;
const auditCreate = vi.fn();
const proposalUpdate = vi.fn(async ({ data }: { data: { status: ProposalState } }) => {
  proposalState = data.status;
  return { id: 'preview-a' };
});

const transactionClient = {
  documentImportProposal: {
    findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
      if (where.id !== 'preview-a' || where.userId !== 'user-a') return null;
      return {
        id: 'preview-a',
        userId: 'user-a',
        documentId: 'document-a',
        status: proposalState,
        resultingInstallmentGroupId: proposalState === 'CONFIRMED' ? 'group-a' : null,
        extractedData: {
          totalAmount: 1200,
          installments: 12,
          summary: 'Contrato sintético',
          firstDueDate: '2030-01-10',
        },
        document: { title: 'Contrato sintético' },
      };
    }),
    updateMany: vi.fn(async () => {
      if (proposalState !== 'READY_FOR_REVIEW') return { count: 0 };
      proposalState = 'PROCESSING';
      return { count: 1 };
    }),
    update: proposalUpdate,
  },
  documentAuditEvent: { create: auditCreate },
};

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}));
vi.mock('@/services/auth/session', () => ({
  currentSessionUserId: vi.fn(async () => 'user-a'),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (tx: typeof transactionClient) => unknown) => callback(transactionClient)),
  },
}));
vi.mock('@/services/repositories', () => ({
  PrismaFinanceRepository: class PrismaFinanceRepository {
    constructor(readonly transaction: unknown) {}
  },
}));
vi.mock('@/services/modules/finance/finance-user-context', () => ({
  runAsFinanceUser: vi.fn(async (_userId: string, operation: () => unknown) => operation()),
}));
vi.mock('@/services/modules', () => ({
  PersistentFinanceService: class PersistentFinanceService {
    async createInstallment() {
      financeEffects += 1;
      await Promise.resolve();
      return {
        success: true,
        message: 'Parcelamento sintético criado.',
        data: [{ installmentGroupId: 'group-a' }],
      };
    }
  },
}));

function request() {
  return new Request('http://localhost/api/document-previews/preview-a/confirm', {
    method: 'POST',
    body: JSON.stringify({
      accountId: 'account-a',
      categoryId: 'category-a',
      startDate: '2030-01-10',
    }),
  });
}

describe('confirmação atômica e idempotente da preview', () => {
  beforeEach(() => {
    proposalState = 'READY_FOR_REVIEW';
    financeEffects = 0;
    auditCreate.mockClear();
    proposalUpdate.mockClear();
    transactionClient.documentImportProposal.findFirst.mockClear();
    transactionClient.documentImportProposal.updateMany.mockClear();
  });

  it('duas confirmações concorrentes produzem um único efeito financeiro', async () => {
    const { POST } = await import('@/app/api/documents/proposals/[id]/confirm/route');
    const responses = await Promise.all([
      POST(request(), { params: { id: 'preview-a' } }),
      POST(request(), { params: { id: 'preview-a' } }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(proposalState).toBe('CONFIRMED');
    expect(financeEffects).toBe(1);
    expect(proposalUpdate).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        operation: 'PREVIEW_CONFIRMED',
        userId: 'user-a',
        after: expect.objectContaining({ installmentGroupId: 'group-a' }),
      }),
    }));
  });

  it('repetição após confirmação retorna o resultado original sem duplicar', async () => {
    proposalState = 'CONFIRMED';
    const { POST } = await import('@/app/api/documents/proposals/[id]/confirm/route');
    const response = await POST(request(), { params: { id: 'preview-a' } });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ alreadyConfirmed: true, installmentGroupId: 'group-a' });
    expect(financeEffects).toBe(0);
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('ID pertencente a outro usuário não chega ao FinanceService', async () => {
    const { POST } = await import('@/app/api/documents/proposals/[id]/confirm/route');
    const response = await POST(request(), { params: { id: 'preview-user-b' } });
    expect(response.status).toBe(404);
    expect(financeEffects).toBe(0);
  });
});
