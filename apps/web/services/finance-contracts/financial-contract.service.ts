import 'server-only';

import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { PersistentFinanceService } from '@/services/modules';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';
import { PrismaFinanceRepository } from '@/services/repositories';
import type {
  CreateFinancialContractInput,
  FinancialContract,
  FinancialContractSummary,
  FinancialDashboard,
  FinancialInstallment,
  FinancialInstallmentWithContract,
  PayFinancialInstallmentInput,
  PayFinancialInstallmentResult,
  SettleFinancialContractInput,
  SettleFinancialContractResult,
  UndoFinancialInstallmentPaymentInput,
  UndoFinancialInstallmentPaymentResult,
} from './financial-contract.types';

/**
 * `FinancialContractService` — evolução "Parcelas & Empréstimos": contrato
 * financeiro (empréstimo/financiamento/parcelamento de cartão/fornecedor)
 * como CABEÇALHO real, com parcelas de ciclo de vida próprio.
 *
 * Integração deliberada com o domínio financeiro já existente (pedido
 * explícito: "não criar um módulo isolado") — nenhuma `Transaction` nasce
 * na criação do contrato; cada `FinancialInstallment` só vira uma
 * `Transaction` de verdade quando paga, via `PersistentFinanceService.
 * createExpense` — o MESMO caminho de qualquer despesa manual (mesma
 * validação de conta/categoria, mesmo `FinanceAuditEvent` de
 * `transaction.created`). `payFinancialInstallment`/
 * `undoFinancialInstallmentPayment` giram dentro de `prisma.$transaction`
 * `Serializable`, igual a `confirmDocumentProposal` (Fase A) — mesmo
 * padrão desta evolução da sessão, não um novo inventado.
 *
 * Auditoria própria (`FinanceAuditEvent`, `entityType: 'financial_contract'`
 * / `'financial_installment'`, operações em SCREAMING_SNAKE) segue o único
 * precedente já existente de "evento de domínio acima de `Transaction`":
 * `FixedAccountOccurrence` (`OCCURRENCE_PAID`/`OCCURRENCE_PARTIAL_PAID`).
 * Por design, um evento por operação em lote (`CONTRACT_CREATED` cobre a
 * criação do contrato + todas as parcelas geradas) — mesmo padrão de
 * `createManyWithAudit` (um evento cobre o lote inteiro, não um por linha).
 */
export class FinancialContractError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

type InstallmentRow = { number: number; amount: number; dueDate: Date };

export type FinancialContractOperationIdentity = {
  userId: string;
  operationId: string;
  channel: string;
  actionKind: 'loan.create' | 'financing.create' | 'contract.create';
};

/** Derivação server-side: o canal fornece a identidade, nunca a chave persistida. */
export function deriveFinancialContractIdempotencyKey(identity: FinancialContractOperationIdentity): string {
  const operationId = identity.operationId.trim();
  const channel = identity.channel.trim().toLowerCase();
  if (!operationId || operationId.length > 200 || !/^[a-zA-Z0-9._:-]+$/.test(operationId)) {
    throw new FinancialContractError(422, 'A identidade da operação financeira é inválida.');
  }
  if (!channel || channel.length > 40 || !/^[a-z0-9_-]+$/.test(channel)) {
    throw new FinancialContractError(422, 'O canal da operação financeira é inválido.');
  }
  const digest = createHash('sha256')
    .update(`financial-contract:v1:${identity.userId}:${channel}:${identity.actionKind}:${operationId}`)
    .digest('hex');
  return `contract:v1:${digest}`;
}

function moneyCents(value: number | undefined): number | null {
  return value === undefined ? null : Math.round(value * 100);
}

/** Fingerprint calculado somente a partir do input de domínio normalizado. */
export function financialContractFingerprint(input: CreateFinancialContractInput): string {
  const canonical = JSON.stringify({
    name: input.name.trim(),
    institution: input.institution?.trim() || null,
    type: input.type,
    origin: input.origin ?? 'PERSONAL',
    categoryId: input.categoryId ?? null,
    accountId: input.accountId ?? null,
    totalAmountCents: moneyCents(input.totalAmount),
    financedAmountCents: moneyCents(input.financedAmount),
    totalInstallments: input.totalInstallments,
    installmentAmountCents: moneyCents(input.installmentAmount),
    dueDay: input.dueDay,
    startDate: input.startDate ? new Date(input.startDate).toISOString() : null,
    endDate: input.endDate ? new Date(input.endDate).toISOString() : null,
    interestRate: input.interestRate ?? null,
    source: input.source ?? 'MANUAL',
    documentId: input.documentId ?? null,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Divide `totalAmount` em `totalInstallments` parcelas, em centavos, sem
 * deriva de ponto flutuante — mesmo algoritmo de `buildInstallmentLegs`
 * (`finance.service.ts`). Quando `installmentAmount` é informado (ex.: "42x
 * de R$6.000"), cada parcela usa esse valor nominal e a ÚLTIMA absorve
 * qualquer resto, para que a soma bata exatamente com `totalAmount`.
 */
function buildInstallmentSchedule(params: {
  totalAmount: number;
  totalInstallments: number;
  installmentAmount?: number;
  dueDay: number;
  startDate: Date;
}): InstallmentRow[] {
  const { totalAmount, totalInstallments, installmentAmount, dueDay, startDate } = params;
  const totalCents = Math.round(totalAmount * 100);
  const perInstallmentCents = installmentAmount !== undefined ? Math.round(installmentAmount * 100) : Math.floor(totalCents / totalInstallments);

  return Array.from({ length: totalInstallments }, (_unused, index) => {
    const isLast = index === totalInstallments - 1;
    const cents = isLast ? totalCents - perInstallmentCents * (totalInstallments - 1) : perInstallmentCents;
    const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + index, dueDay);
    return { number: index + 1, amount: cents / 100, dueDate };
  });
}

function toIso(date: Date): string {
  return date.toISOString();
}

// As linhas abaixo chegam de `prisma.financialContract`/`financialInstallment`
// (incluindo os includes usados neste arquivo) — tipadas estruturalmente para
// não depender de `Prisma.FinancialContractGetPayload<...>` explícito em
// cada chamada.
type ContractRow = {
  id: string;
  userId: string;
  name: string;
  institution: string | null;
  type: string;
  origin: string;
  categoryId: string | null;
  accountId: string | null;
  totalAmount: unknown;
  financedAmount: unknown;
  installmentAmount: unknown;
  totalInstallments: number;
  paidInstallments: number;
  dueDay: number;
  startDate: Date;
  endDate: Date | null;
  interestRate: unknown;
  status: string;
  source: string;
  documentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type InstallmentRowFromDb = {
  id: string;
  contractId: string;
  number: number;
  amount: unknown;
  dueDate: Date;
  status: string;
  paidAt: Date | null;
  paymentTransactionId: string | null;
  createdAt: Date;
};

function toContractDto(row: ContractRow, installments?: InstallmentRowFromDb[]): FinancialContract {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    institution: row.institution,
    type: row.type as FinancialContract['type'],
    origin: row.origin as FinancialContract['origin'],
    categoryId: row.categoryId,
    accountId: row.accountId,
    totalAmount: Number(row.totalAmount),
    financedAmount: row.financedAmount === null ? null : Number(row.financedAmount),
    installmentAmount: Number(row.installmentAmount),
    totalInstallments: row.totalInstallments,
    paidInstallments: row.paidInstallments,
    dueDay: row.dueDay,
    startDate: toIso(row.startDate),
    endDate: row.endDate ? toIso(row.endDate) : null,
    interestRate: row.interestRate === null ? null : Number(row.interestRate),
    status: row.status as FinancialContract['status'],
    source: row.source as FinancialContract['source'],
    documentId: row.documentId,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    installments: installments?.map(toInstallmentDto),
  };
}

function toInstallmentDto(row: InstallmentRowFromDb): FinancialInstallment {
  return {
    id: row.id,
    contractId: row.contractId,
    number: row.number,
    amount: Number(row.amount),
    dueDate: toIso(row.dueDate),
    status: row.status as FinancialInstallment['status'],
    paidAt: row.paidAt ? toIso(row.paidAt) : null,
    paymentTransactionId: row.paymentTransactionId,
    createdAt: toIso(row.createdAt),
  };
}

/**
 * Cria o contrato e já materializa TODAS as parcelas (todas `PENDING`,
 * nenhuma `Transaction` ainda). Espelha o exemplo do script: "Pronampe
 * Santander, R$252.000, 42x de R$6.000, vencimento dia 24" gera as 42
 * linhas de uma vez.
 */
export async function createFinancialContract(input: CreateFinancialContractInput): Promise<FinancialContract> {
  if (!input.name.trim()) throw new FinancialContractError(422, 'Informe o nome do contrato.');
  if (!(input.totalAmount > 0)) throw new FinancialContractError(422, 'O valor total do contrato precisa ser maior que zero.');
  if (!(input.totalInstallments >= 1)) throw new FinancialContractError(422, 'O contrato precisa ter ao menos 1 parcela.');
  if (!(input.dueDay >= 1 && input.dueDay <= 31)) throw new FinancialContractError(422, 'O dia de vencimento precisa estar entre 1 e 31.');
  if (input.source === 'NOVA' && !input.idempotencyKey) {
    throw new FinancialContractError(422, 'A criação de contrato pela NOVA exige uma identidade idempotente.');
  }
  if (input.idempotencyKey && (input.idempotencyKey.length > 120 || !input.idempotencyKey.trim())) {
    throw new FinancialContractError(422, 'A chave idempotente do contrato é inválida.');
  }

  const startDate = input.startDate ? new Date(input.startDate) : new Date();
  if (Number.isNaN(startDate.getTime())) throw new FinancialContractError(422, 'A data de início informada é inválida.');
  if (input.endDate && Number.isNaN(new Date(input.endDate).getTime())) throw new FinancialContractError(422, 'A data de término informada é inválida.');

  const idempotencyFingerprint = input.idempotencyKey ? financialContractFingerprint(input) : undefined;
  const findReplay = async (): Promise<FinancialContract | undefined> => {
    if (!input.idempotencyKey) return undefined;
    const existing = await prisma.financialContract.findFirst({
      where: { userId: input.userId, idempotencyKey: input.idempotencyKey },
      include: { installments: { orderBy: { number: 'asc' } } },
    });
    if (!existing) return undefined;
    if (existing.idempotencyFingerprint !== idempotencyFingerprint) {
      throw new FinancialContractError(409, 'Esta identidade de operação já foi usada com dados diferentes.');
    }
    return toContractDto(existing, existing.installments);
  };

  const replay = await findReplay();
  if (replay) return replay;

  const rows = buildInstallmentSchedule({
    totalAmount: input.totalAmount,
    totalInstallments: input.totalInstallments,
    installmentAmount: input.installmentAmount,
    dueDay: input.dueDay,
    startDate,
  });
  if (rows.some((row) => row.amount <= 0)) {
    throw new FinancialContractError(422, 'O valor da parcela informado é incompatível com o valor total do contrato.');
  }
  const installmentAmount = input.installmentAmount ?? rows[0]?.amount ?? input.totalAmount / input.totalInstallments;

  try {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const contract = await tx.financialContract.create({
        data: {
          userId: input.userId,
          name: input.name.trim(),
          institution: input.institution,
          type: input.type,
          origin: input.origin ?? 'PERSONAL',
          categoryId: input.categoryId,
          accountId: input.accountId,
          totalAmount: input.totalAmount,
          financedAmount: input.financedAmount,
          installmentAmount,
          totalInstallments: input.totalInstallments,
          dueDay: input.dueDay,
          startDate,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          interestRate: input.interestRate,
          status: 'ACTIVE',
          source: input.source ?? 'MANUAL',
          documentId: input.documentId,
          idempotencyKey: input.idempotencyKey,
          idempotencyFingerprint,
          installments: { create: rows.map((row) => ({ number: row.number, amount: row.amount, dueDate: row.dueDate })) },
        },
        include: { installments: { orderBy: { number: 'asc' } } },
      });

      await tx.financeAuditEvent.create({
        data: {
          userId: input.userId,
          actorUserId: input.userId,
          operation: input.documentId ? 'CONTRACT_IMPORTED_FROM_DOCUMENT' : 'CONTRACT_CREATED',
          source: (input.source ?? 'MANUAL').toLowerCase(),
          entityType: 'financial_contract',
          entityId: contract.id,
          after: {
            name: contract.name,
            totalAmount: Number(contract.totalAmount),
            totalInstallments: contract.totalInstallments,
            installmentAmount: Number(contract.installmentAmount),
            dueDay: contract.dueDay,
            documentId: contract.documentId,
          },
        },
      });

      return toContractDto(contract, contract.installments);
    });
  } catch (error) {
    if (input.idempotencyKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const concurrentReplay = await findReplay();
      if (concurrentReplay) return concurrentReplay;
    }
    throw error;
  }
}

export async function listFinancialContracts(userId: string): Promise<FinancialContract[]> {
  const rows: Array<ContractRow & { installments: InstallmentRowFromDb[] }> = await prisma.financialContract.findMany({
    where: { userId },
    include: { installments: { orderBy: { number: 'asc' } } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
  return rows.map((row) => toContractDto(row, row.installments));
}

export async function getFinancialContract(userId: string, id: string): Promise<FinancialContract | undefined> {
  const row = await prisma.financialContract.findFirst({
    where: { id, userId },
    include: { installments: { orderBy: { number: 'asc' } } },
  });
  return row ? toContractDto(row, row.installments) : undefined;
}

/**
 * "Contract detail" (Fase 3, seção 1): total/pago/restante/percentual/
 * próxima parcela/parcelas vencidas — tudo derivado de `contract.
 * installments` já carregado por `getFinancialContract`, nenhuma consulta
 * própria. Função pura para ser fácil de testar isolada e reaproveitável
 * pela rota sem duplicar a leitura do contrato.
 */
export function buildFinancialContractSummary(contract: FinancialContract, reference: Date = new Date()): FinancialContractSummary {
  const installments = contract.installments ?? [];
  const totalAmount = contract.totalAmount ?? 0;

  const paidInstallments = installments.filter((installment) => installment.status === 'PAID');
  const paidAmount = paidInstallments.reduce((sum, installment) => sum + installment.amount, 0);

  const openInstallments = installments.filter((installment) => installment.status === 'PENDING' || installment.status === 'OVERDUE').sort((a, b) => a.number - b.number);
  const remainingAmount = openInstallments.reduce((sum, installment) => sum + installment.amount, 0);

  const percentagePaid = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 10000) / 100 : 0;

  const today = startOfDay(reference);
  const overdueInstallments = openInstallments.filter((installment) => startOfDay(new Date(installment.dueDate)) < today);

  return {
    totalAmount,
    paidAmount,
    remainingAmount,
    percentagePaid,
    nextInstallment: openInstallments[0] ?? null,
    overdueInstallments,
  };
}

/**
 * Marca uma parcela como paga: baixa a parcela, lança a despesa real via
 * `PersistentFinanceService.createExpense` (mesma conta/categoria do
 * contrato — cai na regra padrão de "conta única ativa" quando o contrato
 * não tem `accountId`), soma `paidInstallments` e audita — tudo na mesma
 * transação `Serializable`. Reexecução sobre uma parcela já paga é
 * idempotente (`alreadyPaid: true`, nada muda de novo).
 */
export async function payFinancialInstallment(input: PayFinancialInstallmentInput): Promise<PayFinancialInstallmentResult> {
  const { userId, installmentId } = input;
  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  if (Number.isNaN(paidAt.getTime())) throw new FinancialContractError(422, 'A data de pagamento informada é inválida.');
  const source = input.source ?? 'manual';

  return prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const installment = await tx.financialInstallment.findFirst({
        where: { id: installmentId, contract: { userId } },
        include: { contract: true },
      });
      if (!installment) throw new FinancialContractError(404, 'Parcela não encontrada.');
      if (installment.status === 'PAID') {
        return { alreadyPaid: true, installment: toInstallmentDto(installment), contract: toContractDto(installment.contract) };
      }
      if (installment.status === 'CANCELLED') {
        throw new FinancialContractError(422, 'Esta parcela foi cancelada e não pode ser paga.');
      }

      const reserved = await tx.financialInstallment.updateMany({
        where: { id: installmentId, status: installment.status },
        data: { status: 'PAID', paidAt },
      });
      if (!reserved.count) throw new FinancialContractError(409, 'Esta parcela já está sendo paga em outra requisição.');

      const financeService = new PersistentFinanceService(new PrismaFinanceRepository(tx), userId);
      const result = await runAsFinanceUser(userId, () =>
        financeService.createExpense({
          amount: Number(installment.amount),
          description: `${installment.contract.name} — parcela ${installment.number}/${installment.contract.totalInstallments}`,
          category: 'Empréstimos e Financiamentos',
          categoryId: installment.contract.categoryId ?? undefined,
          date: paidAt.toISOString(),
          accountId: installment.contract.accountId ?? undefined,
          source,
        })
      );
      if (!result.success) throw new FinancialContractError(422, result.message);
      const entry = result.data as { id: string };

      await tx.financialInstallment.update({ where: { id: installmentId }, data: { paymentTransactionId: entry.id } });
      let updatedContract = await tx.financialContract.update({
        where: { id: installment.contractId },
        data: { paidInstallments: { increment: 1 } },
      });

      await tx.financeAuditEvent.create({
        data: {
          userId,
          actorUserId: userId,
          operation: 'INSTALLMENT_PAID',
          source,
          entityType: 'financial_installment',
          entityId: installmentId,
          before: { status: installment.status },
          after: { status: 'PAID', paidAt: paidAt.toISOString(), paymentTransactionId: entry.id },
        },
      });

      // Ciclo de vida (Fase 3, seção 2): quando esta era a última parcela em
      // aberto (nenhuma PENDING/OVERDUE restante — CANCELLED nunca conta,
      // são parcelas fora do compromisso, ex.: quitação antecipada), o
      // contrato sai de ACTIVE para PAID_OFF automaticamente. Consulta
      // separada (não dá pra confiar só em `paidInstallments ===
      // totalInstallments`: uma quitação antecipada cancela parcelas
      // futuras sem elas nunca virarem PAID, então a contagem nunca bateria
      // com o total nesse caminho).
      if (updatedContract.status === 'ACTIVE') {
        const remainingOpen = await tx.financialInstallment.count({
          where: { contractId: installment.contractId, status: { in: ['PENDING', 'OVERDUE'] } },
        });
        if (remainingOpen === 0) {
          updatedContract = await tx.financialContract.update({
            where: { id: installment.contractId },
            data: { status: 'PAID_OFF' },
          });
          await tx.financeAuditEvent.create({
            data: {
              userId,
              actorUserId: userId,
              operation: 'CONTRACT_PAID_OFF',
              source,
              entityType: 'financial_contract',
              entityId: installment.contractId,
              before: { status: 'ACTIVE' },
              after: { status: 'PAID_OFF', paidInstallments: updatedContract.paidInstallments, totalInstallments: updatedContract.totalInstallments },
            },
          });
        }
      }

      const finalInstallment = await tx.financialInstallment.findUniqueOrThrow({ where: { id: installmentId } });
      return { alreadyPaid: false, installment: toInstallmentDto(finalInstallment), contract: toContractDto(updatedContract) };
    },
    { isolationLevel: 'Serializable' }
  );
}

/**
 * Desfaz o pagamento: NUNCA apaga — devolve a parcela a `PENDING` e estorna
 * a `Transaction` original via `PersistentFinanceService.reverseTransaction`
 * (o lançamento original é preservado com `status: 'estornada'`, mais um
 * lançamento inverso; mesma regra de qualquer outro estorno do app).
 */
export async function undoFinancialInstallmentPayment(input: UndoFinancialInstallmentPaymentInput): Promise<UndoFinancialInstallmentPaymentResult> {
  const { userId, installmentId } = input;
  const source = input.source ?? 'manual';

  return prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const installment = await tx.financialInstallment.findFirst({
        where: { id: installmentId, contract: { userId } },
        include: { contract: true },
      });
      if (!installment) throw new FinancialContractError(404, 'Parcela não encontrada.');
      if (installment.status !== 'PAID') throw new FinancialContractError(422, 'Esta parcela não está paga.');
      if (!installment.paymentTransactionId) {
        throw new FinancialContractError(422, 'Esta parcela está marcada como paga sem uma transação associada — não é possível desfazer automaticamente.');
      }

      const reserved = await tx.financialInstallment.updateMany({
        where: { id: installmentId, status: 'PAID' },
        data: { status: 'PENDING', paidAt: null, paymentTransactionId: null },
      });
      if (!reserved.count) throw new FinancialContractError(409, 'Esta parcela já foi alterada em outra requisição.');

      const financeService = new PersistentFinanceService(new PrismaFinanceRepository(tx), userId);
      const result = await runAsFinanceUser(userId, () => financeService.reverseTransaction(installment.paymentTransactionId as string, source));
      if (!result.success) throw new FinancialContractError(422, result.message);

      let updatedContract = await tx.financialContract.update({
        where: { id: installment.contractId },
        data: { paidInstallments: { decrement: 1 } },
      });

      await tx.financeAuditEvent.create({
        data: {
          userId,
          actorUserId: userId,
          operation: 'INSTALLMENT_REVERSED',
          source,
          entityType: 'financial_installment',
          entityId: installmentId,
          before: { status: 'PAID', paymentTransactionId: installment.paymentTransactionId },
          after: { status: 'PENDING' },
        },
      });

      // Ciclo de vida (Fase 3, seção 2), caminho inverso: desfazer o
      // pagamento da última parcela de um contrato já PAID_OFF reabre uma
      // pendência de verdade — o contrato volta pra ACTIVE. `installment.
      // contract.status` é o estado ANTES desta transação (capturado no
      // `findFirst` acima), nunca reconsultado depois de já ter mudado.
      if (installment.contract.status === 'PAID_OFF') {
        updatedContract = await tx.financialContract.update({
          where: { id: installment.contractId },
          data: { status: 'ACTIVE' },
        });
        await tx.financeAuditEvent.create({
          data: {
            userId,
            actorUserId: userId,
            operation: 'CONTRACT_REOPENED',
            source,
            entityType: 'financial_contract',
            entityId: installment.contractId,
            before: { status: 'PAID_OFF' },
            after: { status: 'ACTIVE' },
          },
        });
      }

      const finalInstallment = await tx.financialInstallment.findUniqueOrThrow({ where: { id: installmentId } });
      return { installment: toInstallmentDto(finalInstallment), contract: toContractDto(updatedContract) };
    },
    { isolationLevel: 'Serializable' }
  );
}

/**
 * Quitação antecipada (Fase 3, seção 3 / doc 24-financial-domain.md §5.9:
 * "quitação antecipada cria evento próprio e cancela apenas parcelas
 * futuras não liquidadas"). NUNCA mexe em parcelas já PAID — histórico
 * preservado, nada é apagado nem reescrito. Só cancela as parcelas ainda em
 * aberto (PENDING/OVERDUE) e move o contrato pra PAID_OFF (mesmo estado
 * terminal de "todas as parcelas pagas" — a Fase 3 não introduz um quarto
 * status só para este caminho). Não cria `Transaction`: a doc de domínio
 * não pede lançar a liquidação do saldo devedor como despesa aqui, só
 * fechar o compromisso futuro — mesmo padrão de "cancelamento" da seção
 * 5.12 (não gera caixa realizado).
 */
export async function settleFinancialContract(input: SettleFinancialContractInput): Promise<SettleFinancialContractResult> {
  const { userId, contractId } = input;
  const settledAt = input.settledAt ? new Date(input.settledAt) : new Date();
  if (Number.isNaN(settledAt.getTime())) throw new FinancialContractError(422, 'A data de quitação informada é inválida.');
  const source = input.source ?? 'manual';

  return prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const contract = await tx.financialContract.findFirst({
        where: { id: contractId, userId },
        include: { installments: { orderBy: { number: 'asc' } } },
      });
      if (!contract) throw new FinancialContractError(404, 'Contrato não encontrado.');
      if (contract.status === 'CANCELLED') throw new FinancialContractError(422, 'Este contrato foi cancelado e não pode ser quitado.');
      if (contract.status === 'PAID_OFF') throw new FinancialContractError(422, 'Este contrato já está quitado.');

      const openInstallments = contract.installments.filter((installment: InstallmentRowFromDb) => installment.status === 'PENDING' || installment.status === 'OVERDUE');

      if (openInstallments.length > 0) {
        await tx.financialInstallment.updateMany({
          where: { contractId, status: { in: ['PENDING', 'OVERDUE'] } },
          data: { status: 'CANCELLED' },
        });
      }

      const updatedContract = await tx.financialContract.update({
        where: { id: contractId },
        data: { status: 'PAID_OFF' },
        include: { installments: { orderBy: { number: 'asc' } } },
      });

      await tx.financeAuditEvent.create({
        data: {
          userId,
          actorUserId: userId,
          operation: 'CONTRACT_SETTLED',
          source,
          entityType: 'financial_contract',
          entityId: contractId,
          before: { status: contract.status, openInstallments: openInstallments.length },
          after: { status: 'PAID_OFF', settledAt: settledAt.toISOString(), cancelledInstallmentIds: openInstallments.map((installment: InstallmentRowFromDb) => installment.id) },
        },
      });

      const cancelledIds = new Set(openInstallments.map((installment: InstallmentRowFromDb) => installment.id));
      const cancelledInstallments = updatedContract.installments.filter((installment: InstallmentRowFromDb) => cancelledIds.has(installment.id)).map(toInstallmentDto);

      return { contract: toContractDto(updatedContract, updatedContract.installments), cancelledInstallments };
    },
    { isolationLevel: 'Serializable' }
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toInstallmentWithContract(row: InstallmentRowFromDb & { contract: { name: string; institution: string | null } }): FinancialInstallmentWithContract {
  return { ...toInstallmentDto(row), contractName: row.contract.name, contractInstitution: row.contract.institution };
}

/**
 * Indicadores + blocos inteligentes (seção 6/7 do script) — uma única
 * consulta de todas as parcelas não canceladas do usuário, agregada em
 * memória (volume esperado por usuário é baixo; sem necessidade de SQL
 * agregado nesta fase).
 */
export async function getFinancialDashboard(userId: string, reference: Date = new Date()): Promise<FinancialDashboard> {
  const rows: Array<InstallmentRowFromDb & { contract: { name: string; institution: string | null } }> = await prisma.financialInstallment.findMany({
    where: { contract: { userId }, status: { not: 'CANCELLED' } },
    include: { contract: { select: { name: true, institution: true } } },
    orderBy: { dueDate: 'asc' },
  });

  const today = startOfDay(reference);
  const monthStart = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const monthEnd = new Date(reference.getFullYear(), reference.getMonth() + 1, 0, 23, 59, 59, 999);
  const weekEnd = new Date(today.getTime() + 7 * DAY_MS);

  const outstanding = rows.filter((row) => row.status === 'PENDING' || row.status === 'OVERDUE');
  const dueThisMonthRows = outstanding.filter((row) => row.dueDate >= monthStart && row.dueDate <= monthEnd);
  const paidThisMonthRows = rows.filter((row) => row.status === 'PAID' && row.paidAt && row.paidAt >= monthStart && row.paidAt <= monthEnd);
  const dueTodayRows = outstanding.filter((row) => startOfDay(row.dueDate).getTime() === today.getTime());
  const dueThisWeekRows = outstanding.filter((row) => row.dueDate >= today && row.dueDate <= weekEnd);
  const overdueRows = outstanding.filter((row) => row.dueDate < today);

  const sum = (list: typeof rows) => list.reduce((total, row) => total + Number(row.amount), 0);

  return {
    outstandingBalance: { count: outstanding.length, total: sum(outstanding) },
    dueThisMonth: { count: dueThisMonthRows.length, total: sum(dueThisMonthRows), items: dueThisMonthRows.map(toInstallmentWithContract) },
    paidThisMonth: { count: paidThisMonthRows.length, total: sum(paidThisMonthRows) },
    pending: { count: outstanding.length, total: sum(outstanding) },
    dueToday: dueTodayRows.map(toInstallmentWithContract),
    dueThisWeek: dueThisWeekRows.map(toInstallmentWithContract),
    overdue: { count: overdueRows.length, total: sum(overdueRows), items: overdueRows.map(toInstallmentWithContract) },
  };
}
