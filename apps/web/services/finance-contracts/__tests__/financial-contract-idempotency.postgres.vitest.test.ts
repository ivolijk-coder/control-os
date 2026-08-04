import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const enabled = process.env.RUN_FINANCIAL_CONTRACT_POSTGRES_TEST === '1';
const userId = '00000000-0000-4000-8000-000000000061';

describe.runIf(enabled)('FinancialContract idempotency — PostgreSQL real', () => {
  beforeAll(async () => {
    const { prisma } = await import('@/lib/prisma');
    await prisma.financeAuditEvent.deleteMany({ where: { userId } });
    await prisma.financialContract.deleteMany({ where: { userId } });
  });

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma');
    await prisma.financeAuditEvent.deleteMany({ where: { userId } });
    await prisma.financialContract.deleteMany({ where: { userId } });
    await prisma.$disconnect();
  });

  it('duas criações concorrentes geram um contrato, suas parcelas e uma auditoria', async () => {
    const { createFinancialContract, deriveFinancialContractIdempotencyKey } = await import('../financial-contract.service');
    const { prisma } = await import('@/lib/prisma');
    const idempotencyKey = deriveFinancialContractIdempotencyKey({
      userId,
      operationId: 'postgres-concurrency-1',
      channel: 'web',
      actionKind: 'loan.create',
    });
    const input = {
      userId,
      name: 'Empréstimo concorrente',
      institution: 'Nubank',
      type: 'LOAN' as const,
      totalAmount: 9000,
      installmentAmount: 300,
      totalInstallments: 30,
      dueDay: 10,
      startDate: '2026-08-10',
      source: 'NOVA' as const,
      idempotencyKey,
    };

    const [first, second] = await Promise.all([
      createFinancialContract(input),
      createFinancialContract(input),
    ]);

    expect(second.id).toBe(first.id);
    expect(await prisma.financialContract.count({ where: { userId, idempotencyKey } })).toBe(1);
    expect(await prisma.financialInstallment.count({ where: { contractId: first.id } })).toBe(30);
    expect(await prisma.financeAuditEvent.count({ where: { userId, entityId: first.id, operation: 'CONTRACT_CREATED' } })).toBe(1);
  });
});
