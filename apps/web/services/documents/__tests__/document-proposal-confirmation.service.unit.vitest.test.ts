import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Testes de regressão da Fase A ("NOVA como centro da experiência"):
 * `DocumentProposalConfirmationService` extraído de `confirm/route.ts`
 * precisa continuar atômico e idempotente chamado DIRETAMENTE (sem passar
 * por `Request`/`NextResponse`) — é exatamente assim que a Action
 * conversacional da NOVA (Fase E) vai chamá-lo, sem HTTP no meio.
 *
 * `confirmation.integration.vitest.test.ts` continua cobrindo o mesmo
 * cenário através da rota HTTP; este arquivo cobre o service isoladamente.
 */

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

describe('confirmDocumentProposal — chamado diretamente pelo service (sem HTTP)', () => {
  beforeEach(() => {
    proposalState = 'READY_FOR_REVIEW';
    financeEffects = 0;
    auditCreate.mockClear();
    proposalUpdate.mockClear();
    transactionClient.documentImportProposal.findFirst.mockClear();
    transactionClient.documentImportProposal.updateMany.mockClear();
  });

  it('confirma, cria o parcelamento uma única vez e registra auditoria com correlationId', async () => {
    const { confirmDocumentProposal } = await import('../document-proposal-confirmation.service');
    const outcome = await confirmDocumentProposal({
      proposalId: 'preview-a',
      userId: 'user-a',
      accountId: 'account-a',
      categoryId: 'category-a',
      startDate: '2030-01-10',
    });

    expect(outcome).toMatchObject({ alreadyConfirmed: false, installmentGroupId: 'group-a' });
    expect(proposalState).toBe('CONFIRMED');
    expect(financeEffects).toBe(1);
    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        operation: 'PREVIEW_CONFIRMED',
        userId: 'user-a',
        correlationId: expect.any(String),
        after: expect.objectContaining({ installmentGroupId: 'group-a' }),
      }),
    }));
  });

  it('duas chamadas concorrentes produzem um único efeito financeiro (reserva atômica)', async () => {
    const { confirmDocumentProposal, ConfirmationError } = await import('../document-proposal-confirmation.service');
    const call = () => confirmDocumentProposal({
      proposalId: 'preview-a',
      userId: 'user-a',
      accountId: 'account-a',
      categoryId: 'category-a',
    });

    const results = await Promise.allSettled([call(), call()]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConfirmationError);
    expect((rejected[0] as PromiseRejectedResult).reason.status).toBe(409);
    expect(financeEffects).toBe(1);
  });

  it('repetição após confirmação é idempotente: retorna o resultado original sem duplicar', async () => {
    proposalState = 'CONFIRMED';
    const { confirmDocumentProposal } = await import('../document-proposal-confirmation.service');
    const outcome = await confirmDocumentProposal({
      proposalId: 'preview-a',
      userId: 'user-a',
      accountId: 'account-a',
      categoryId: 'category-a',
    });

    expect(outcome).toMatchObject({ alreadyConfirmed: true, installmentGroupId: 'group-a' });
    expect(financeEffects).toBe(0);
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('ID pertencente a outro usuário nunca chega ao FinanceService', async () => {
    const { confirmDocumentProposal, ConfirmationError } = await import('../document-proposal-confirmation.service');
    await expect(confirmDocumentProposal({
      proposalId: 'preview-user-b',
      userId: 'user-a',
      accountId: 'account-a',
      categoryId: 'category-a',
    })).rejects.toBeInstanceOf(ConfirmationError);
    expect(financeEffects).toBe(0);
  });

  it('campos financeiros insuficientes nunca criam parcelamento nem confirmam a proposta', async () => {
    transactionClient.documentImportProposal.findFirst.mockImplementationOnce(async () => ({
      id: 'preview-a',
      userId: 'user-a',
      documentId: 'document-a',
      status: 'READY_FOR_REVIEW',
      resultingInstallmentGroupId: null,
      extractedData: { totalAmount: null, installments: null },
      document: { title: 'Documento sem dados financeiros' },
    } as unknown as Awaited<ReturnType<typeof transactionClient.documentImportProposal.findFirst>>));
    const { confirmDocumentProposal } = await import('../document-proposal-confirmation.service');
    await expect(confirmDocumentProposal({
      proposalId: 'preview-a',
      userId: 'user-a',
      accountId: 'account-a',
      categoryId: 'category-a',
    })).rejects.toMatchObject({ status: 422 });
    expect(financeEffects).toBe(0);
    expect(auditCreate).not.toHaveBeenCalled();
  });
});
