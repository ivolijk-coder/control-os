import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Testes da evolução "Parcelas & Empréstimos" — `FinancialContractService`.
 * Mesmo estilo de mock de `document-proposal-confirmation.service.unit.
 * vitest.test.ts` (Fase A): um `tx` fake em memória, sem tocar Prisma de
 * verdade (geração do client bloqueada neste sandbox).
 */

type InstallmentRow = {
  id: string;
  contractId: string;
  number: number;
  amount: number;
  dueDate: Date;
  status: string;
  paidAt: Date | null;
  paymentTransactionId: string | null;
  createdAt: Date;
};

type ContractRow = {
  id: string;
  userId: string;
  name: string;
  institution: string | null;
  type: string;
  origin: string;
  categoryId: string | null;
  accountId: string | null;
  totalAmount: number;
  financedAmount: number | null;
  installmentAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  dueDay: number;
  startDate: Date;
  endDate: Date | null;
  interestRate: number | null;
  status: string;
  source: string;
  documentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

let contracts: Map<string, ContractRow>;
let installments: Map<string, InstallmentRow>;
let nextId: number;
let financeEffects: { expenses: number; reversals: number };
let dashboardRows: Array<InstallmentRow & { contract: { name: string; institution: string | null } }>;
const auditCreate = vi.fn();
const dashboardFindMany = vi.fn(async () => dashboardRows);

function newId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

type CreateContractData = {
  userId: string;
  name: string;
  institution?: string;
  type: string;
  origin: string;
  categoryId?: string;
  accountId?: string;
  totalAmount: number;
  financedAmount?: number;
  installmentAmount: number;
  totalInstallments: number;
  dueDay: number;
  startDate: Date;
  endDate?: Date;
  interestRate?: number;
  status: string;
  source: string;
  documentId?: string;
  installments?: { create: Array<{ number: number; amount: number; dueDate: Date }> };
};

const tx = {
  financialContract: {
    create: vi.fn(async ({ data }: { data: CreateContractData }) => {
      const id = newId('contract');
      const now = new Date();
      const row: ContractRow = {
        id,
        userId: data.userId,
        name: data.name,
        institution: data.institution ?? null,
        type: data.type,
        origin: data.origin,
        categoryId: data.categoryId ?? null,
        accountId: data.accountId ?? null,
        totalAmount: data.totalAmount,
        financedAmount: data.financedAmount ?? null,
        installmentAmount: data.installmentAmount,
        totalInstallments: data.totalInstallments,
        paidInstallments: 0,
        dueDay: data.dueDay,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        interestRate: data.interestRate ?? null,
        status: data.status,
        source: data.source,
        documentId: data.documentId ?? null,
        createdAt: now,
        updatedAt: now,
      };
      contracts.set(id, row);
      const created = (data.installments?.create ?? []).map((item) => {
        const installmentId = newId('installment');
        const installmentRow: InstallmentRow = {
          id: installmentId,
          contractId: id,
          number: item.number,
          amount: item.amount,
          dueDate: item.dueDate,
          status: 'PENDING',
          paidAt: null,
          paymentTransactionId: null,
          createdAt: now,
        };
        installments.set(installmentId, installmentRow);
        return installmentRow;
      });
      return { ...row, installments: created };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: { paidInstallments?: { increment?: number; decrement?: number } } }) => {
      const row = contracts.get(where.id);
      if (!row) throw new Error('contract not found');
      if (data.paidInstallments?.increment) row.paidInstallments += data.paidInstallments.increment;
      if (data.paidInstallments?.decrement) row.paidInstallments -= data.paidInstallments.decrement;
      row.updatedAt = new Date();
      return row;
    }),
  },
  financialInstallment: {
    findFirst: vi.fn(async ({ where }: { where: { id: string; contract: { userId: string } } }) => {
      const row = installments.get(where.id);
      if (!row) return null;
      const contract = contracts.get(row.contractId);
      if (!contract || contract.userId !== where.contract.userId) return null;
      return { ...row, contract };
    }),
    updateMany: vi.fn(async ({ where, data }: { where: { id: string; status: string }; data: Partial<InstallmentRow> }) => {
      const row = installments.get(where.id);
      if (!row || row.status !== where.status) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<InstallmentRow> }) => {
      const row = installments.get(where.id);
      if (!row) throw new Error('installment not found');
      Object.assign(row, data);
      return row;
    }),
    findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
      const row = installments.get(where.id);
      if (!row) throw new Error('installment not found');
      return row;
    }),
  },
  financeAuditEvent: { create: auditCreate },
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    financialInstallment: { findMany: dashboardFindMany },
  },
}));
vi.mock('@/services/repositories', () => ({
  PrismaFinanceRepository: class PrismaFinanceRepository {
    constructor(readonly transactionClient: unknown) {}
  },
}));
vi.mock('@/services/modules/finance/finance-user-context', () => ({
  runAsFinanceUser: vi.fn(async (_userId: string, operation: () => unknown) => operation()),
}));
vi.mock('@/services/modules', () => ({
  PersistentFinanceService: class PersistentFinanceService {
    async createExpense(input: { amount: number }) {
      financeEffects.expenses += 1;
      return { success: true, message: 'Despesa registrada.', data: { id: newId('transaction'), amount: input.amount } };
    }
    async reverseTransaction(_id: string) {
      financeEffects.reversals += 1;
      return { success: true, message: 'Estorno registrado.', data: { id: newId('reversal') } };
    }
  },
}));

async function createPronampeContract() {
  const { createFinancialContract } = await import('../financial-contract.service');
  return createFinancialContract({
    userId: 'user-a',
    name: 'Pronampe Santander',
    institution: 'Santander',
    type: 'LOAN',
    totalAmount: 252000,
    installmentAmount: 6000,
    totalInstallments: 42,
    dueDay: 24,
    startDate: '2026-08-01',
  });
}

describe('createFinancialContract', () => {
  beforeEach(() => {
    contracts = new Map();
    installments = new Map();
    nextId = 0;
    financeEffects = { expenses: 0, reversals: 0 };
    dashboardRows = [];
    auditCreate.mockClear();
  });

  it('gera as 42 parcelas automaticamente e audita CONTRACT_CREATED (exemplo do script)', async () => {
    const contract = await createPronampeContract();

    expect(contract.totalInstallments).toBe(42);
    expect(contract.installmentAmount).toBe(6000);
    expect(contract.paidInstallments).toBe(0);
    expect(contract.status).toBe('ACTIVE');
    expect(contract.installments).toHaveLength(42);
    expect(contract.installments?.[0]).toMatchObject({ number: 1, amount: 6000, status: 'PENDING' });
    expect(contract.installments?.[41]).toMatchObject({ number: 42, amount: 6000 });
    const total = contract.installments!.reduce((sum, item) => sum + item.amount, 0);
    expect(total).toBeCloseTo(252000, 2);

    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ operation: 'CONTRACT_CREATED', entityType: 'financial_contract', entityId: contract.id }),
      })
    );
  });

  it('sem installmentAmount explícito, divide totalAmount em centavos sem deriva (última parcela absorve o resto)', async () => {
    const { createFinancialContract } = await import('../financial-contract.service');
    const contract = await createFinancialContract({ userId: 'user-a', name: 'Cartão', type: 'CARD_INSTALLMENT', totalAmount: 100, totalInstallments: 3, dueDay: 10 });

    const amounts = contract.installments!.map((item) => item.amount);
    expect(amounts).toEqual([33.33, 33.33, 33.34]);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 2);
  });

  it('marca CONTRACT_IMPORTED_FROM_DOCUMENT quando documentId está presente', async () => {
    const { createFinancialContract } = await import('../financial-contract.service');
    await createFinancialContract({ userId: 'user-a', name: 'Financiamento', type: 'FINANCING', totalAmount: 1000, totalInstallments: 2, dueDay: 5, documentId: 'document-a', source: 'DOCUMENT' });

    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ operation: 'CONTRACT_IMPORTED_FROM_DOCUMENT' }) }));
  });

  it('rejeita valor total zero ou negativo', async () => {
    const { createFinancialContract, FinancialContractError } = await import('../financial-contract.service');
    await expect(createFinancialContract({ userId: 'user-a', name: 'X', type: 'LOAN', totalAmount: 0, totalInstallments: 2, dueDay: 5 })).rejects.toBeInstanceOf(FinancialContractError);
  });

  it('rejeita dia de vencimento fora de 1-31', async () => {
    const { createFinancialContract, FinancialContractError } = await import('../financial-contract.service');
    await expect(createFinancialContract({ userId: 'user-a', name: 'X', type: 'LOAN', totalAmount: 100, totalInstallments: 2, dueDay: 32 })).rejects.toBeInstanceOf(FinancialContractError);
  });
});

describe('payFinancialInstallment / undoFinancialInstallmentPayment', () => {
  beforeEach(() => {
    contracts = new Map();
    installments = new Map();
    nextId = 0;
    financeEffects = { expenses: 0, reversals: 0 };
    dashboardRows = [];
    auditCreate.mockClear();
  });

  it('baixa a parcela, cria a despesa real via FinanceService e soma paidInstallments (seção 4 do script)', async () => {
    const contract = await createPronampeContract();
    const installmentId = contract.installments![2]!.id; // "parcela 3/42", igual ao exemplo do script
    const { payFinancialInstallment } = await import('../financial-contract.service');

    const result = await payFinancialInstallment({ userId: 'user-a', installmentId, paidAt: '2026-08-02' });

    expect(result.alreadyPaid).toBe(false);
    expect(result.installment.status).toBe('PAID');
    expect(result.installment.paymentTransactionId).toBeTruthy();
    expect(result.contract.paidInstallments).toBe(1);
    expect(financeEffects.expenses).toBe(1);
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ operation: 'INSTALLMENT_PAID', entityId: installmentId }) }));
  });

  it('reexecução sobre parcela já paga é idempotente — nunca duplica a despesa', async () => {
    const contract = await createPronampeContract();
    const installmentId = contract.installments![0]!.id;
    const { payFinancialInstallment } = await import('../financial-contract.service');

    await payFinancialInstallment({ userId: 'user-a', installmentId });
    const replay = await payFinancialInstallment({ userId: 'user-a', installmentId });

    expect(replay.alreadyPaid).toBe(true);
    expect(financeEffects.expenses).toBe(1);
  });

  it('duas chamadas concorrentes sobre a mesma parcela produzem um único pagamento (reserva atômica)', async () => {
    const contract = await createPronampeContract();
    const installmentId = contract.installments![0]!.id;
    const { payFinancialInstallment, FinancialContractError } = await import('../financial-contract.service');
    const call = () => payFinancialInstallment({ userId: 'user-a', installmentId });

    const results = await Promise.allSettled([call(), call()]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(FinancialContractError);
    expect(financeEffects.expenses).toBe(1);
  });

  it('parcela de outro usuário nunca é encontrada nem paga', async () => {
    const contract = await createPronampeContract();
    const installmentId = contract.installments![0]!.id;
    const { payFinancialInstallment, FinancialContractError } = await import('../financial-contract.service');

    await expect(payFinancialInstallment({ userId: 'user-b', installmentId })).rejects.toBeInstanceOf(FinancialContractError);
    expect(financeEffects.expenses).toBe(0);
  });

  it('desfaz o pagamento: parcela volta PENDING, estorna a transação (nunca apaga) e subtrai paidInstallments (seção 5 do script)', async () => {
    const contract = await createPronampeContract();
    const installmentId = contract.installments![0]!.id;
    const { payFinancialInstallment, undoFinancialInstallmentPayment } = await import('../financial-contract.service');

    await payFinancialInstallment({ userId: 'user-a', installmentId });
    const result = await undoFinancialInstallmentPayment({ userId: 'user-a', installmentId });

    expect(result.installment.status).toBe('PENDING');
    expect(result.installment.paymentTransactionId).toBeNull();
    expect(result.installment.paidAt).toBeNull();
    expect(result.contract.paidInstallments).toBe(0);
    expect(financeEffects.reversals).toBe(1);
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ operation: 'INSTALLMENT_REVERSED', entityId: installmentId }) }));
  });

  it('não é possível desfazer o pagamento de uma parcela que não está paga', async () => {
    const contract = await createPronampeContract();
    const installmentId = contract.installments![0]!.id;
    const { undoFinancialInstallmentPayment, FinancialContractError } = await import('../financial-contract.service');

    await expect(undoFinancialInstallmentPayment({ userId: 'user-a', installmentId })).rejects.toBeInstanceOf(FinancialContractError);
    expect(financeEffects.reversals).toBe(0);
  });
});

describe('getFinancialDashboard', () => {
  beforeEach(() => {
    contracts = new Map();
    installments = new Map();
    nextId = 0;
    financeEffects = { expenses: 0, reversals: 0 };
    auditCreate.mockClear();
    dashboardFindMany.mockClear();
  });

  it('separa vence hoje / vence essa semana / atrasadas (seção 6-7 do script)', async () => {
    const reference = new Date(2026, 7, 10); // 10/08/2026
    const row = (overrides: Partial<InstallmentRow>) => ({
      id: newId('installment'),
      contractId: 'contract-a',
      number: 1,
      amount: 1000,
      status: 'PENDING',
      paidAt: null,
      paymentTransactionId: null,
      createdAt: reference,
      dueDate: reference,
      contract: { name: 'Bradesco', institution: 'Bradesco' },
      ...overrides,
    });
    dashboardRows = [
      row({ dueDate: new Date(2026, 7, 10), amount: 500 }), // hoje
      row({ dueDate: new Date(2026, 7, 12), amount: 300 }), // essa semana
      row({ dueDate: new Date(2026, 7, 5), status: 'OVERDUE', amount: 700 }), // atrasada
      row({ dueDate: new Date(2026, 7, 15), status: 'PAID', paidAt: new Date(2026, 7, 8), amount: 400 }), // paga no mês
    ];

    const { getFinancialDashboard } = await import('../financial-contract.service');
    const dashboard = await getFinancialDashboard('user-a', reference);

    expect(dashboard.dueToday).toHaveLength(1);
    expect(dashboard.dueToday[0]!.amount).toBe(500);
    expect(dashboard.dueThisWeek.map((item) => item.amount).sort()).toEqual([300, 500]);
    expect(dashboard.overdue).toHaveLength(1);
    expect(dashboard.overdue[0]!.amount).toBe(700);
    expect(dashboard.paidThisMonth).toEqual({ count: 1, total: 400 });
    expect(dashboard.outstandingBalance.count).toBe(3);
  });
});
