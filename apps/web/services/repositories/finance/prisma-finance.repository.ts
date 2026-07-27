import { AccountKind, AccountStatus, CategoryStatus, Prisma, TransactionOrigin, TransactionType, TransferDirection } from '@prisma/client';
import type { Account as PrismaAccountRow, Category as PrismaCategoryRow, Transaction as PrismaTransactionRow } from '@prisma/client';
import type {
  FinanceAccount,
  FinanceAccountKind,
  FinanceCategory,
  FinanceEntry,
  FinanceEntryType,
  FinanceTransferDirection,
} from '@control-os/types';
import { prisma } from '@/lib/prisma';
import type { FinanceRepository } from './finance-repository.interfaces';
import type {
  CreateFinanceAccountInput,
  CreateFinanceCategoryInput,
  CreateFinanceTransactionInput,
  FinanceAccountBalance,
  FinanceCategoryBreakdownItem,
  FinanceSummary,
  FinanceTransactionFilter,
  SetFinanceAccountStatusInput,
  SetFinanceCategoryStatusInput,
  UpdateFinanceAccountInput,
  UpdateFinanceCategoryInput,
  UpdateFinanceTransactionInput,
} from './finance-repository.types';

/**
 * `PrismaFinanceRepository` — CONTROL OS Fase 6 (Persistência real); Fase 7
 * (Financeiro completo) adiciona Contas, Categorias, transferências,
 * parcelamentos e as consultas agregadas do Dashboard. "Ela será a única
 * classe que conhece Prisma." Nenhum outro arquivo de todo o CONTROL OS
 * importa `@prisma/client` ou `@/lib/prisma` além deste.
 *
 * IMPORTANTE — limite de verificação deste ambiente: este sandbox não tem
 * acesso à registry do npm (instalar `prisma`/`@prisma/client` não é
 * possível aqui) nem a um servidor PostgreSQL. Este arquivo foi escrito
 * seguindo exatamente as convenções documentadas e estáveis do Prisma
 * Client (nomes de model em camelCase, `Prisma.Decimal`/
 * `Prisma.TransactionWhereInput` gerados a partir de `schema.prisma`,
 * `groupBy`/`aggregate` para consultas agregadas) — mas NÃO pôde ser
 * typechecked contra o client gerado de verdade, nem executado contra um
 * Postgres real, aqui. Rodar `pnpm install && pnpm --filter @control-os/web
 * db:generate && pnpm --filter @control-os/web db:migrate` na máquina
 * local é o que valida isto de ponta a ponta. `InMemoryFinanceRepository`
 * (mesmo diretório) é quem valida toda a lógica de `FinanceService` de
 * verdade nesta sandbox.
 *
 * Scoping por `userId`: `update`/`delete` fazem um `findFirst({id, userId})`
 * antes de mutar — não dá pra usar `where: {id, userId}` direto em
 * `update()`/`delete()` porque o Prisma exige que `where` de uma mutação
 * única use um campo (ou combinação) com constraint UNIQUE, e `(id,
 * userId)` não é uma unique key aqui (só `id` é); confirmar posse primeiro
 * evita tanto um erro de tipo quanto — mais importante — evita que um
 * `id` de outro usuário seja mutável só por adivinhação.
 */
export class PrismaFinanceRepository implements FinanceRepository {
  // --- Transações -------------------------------------------------------

  async create(userId: string, input: CreateFinanceTransactionInput): Promise<FinanceEntry> {
    const row = await prisma.transaction.create({ data: toCreateData(userId, input) });
    return toFinanceEntry(row);
  }

  /**
   * CONTROL OS — Fase 7: `prisma.$transaction([...])` (a variante "array de
   * queries", não a de callback) — todas as pernas de uma transferência ou
   * todas as parcelas de um parcelamento são criadas atomicamente: se uma
   * falhar, nenhuma fica gravada. "Usar transações quando necessário."
   */
  async createMany(userId: string, inputs: CreateFinanceTransactionInput[]): Promise<FinanceEntry[]> {
    const rows = await prisma.$transaction(
      inputs.map((input) => prisma.transaction.create({ data: toCreateData(userId, input) }))
    );
    return rows.map(toFinanceEntry);
  }

  async update(userId: string, input: UpdateFinanceTransactionInput): Promise<FinanceEntry | undefined> {
    const existing = await prisma.transaction.findFirst({ where: { id: input.id, userId } });
    if (!existing) return undefined;

    const row = await prisma.transaction.update({
      where: { id: input.id },
      data: {
        amount: input.amount !== undefined ? new Prisma.Decimal(input.amount) : undefined,
        description: input.description,
        category: input.category,
        categoryId: input.categoryId,
        date: input.date !== undefined ? new Date(input.date) : undefined,
        accountId: input.accountId,
      },
    });
    return toFinanceEntry(row);
  }

  async delete(userId: string, id: string): Promise<FinanceEntry | undefined> {
    const existing = await prisma.transaction.findFirst({ where: { id, userId } });
    if (!existing) return undefined;

    const row = await prisma.transaction.delete({ where: { id } });
    return toFinanceEntry(row);
  }

  async findById(userId: string, id: string): Promise<FinanceEntry | undefined> {
    const row = await prisma.transaction.findFirst({ where: { id, userId } });
    return row ? toFinanceEntry(row) : undefined;
  }

  async list(userId: string, filter?: FinanceTransactionFilter): Promise<FinanceEntry[]> {
    const rows = await prisma.transaction.findMany({
      where: buildWhere(userId, filter),
      orderBy: { date: 'desc' },
    });
    return rows.map(toFinanceEntry);
  }

  async getRecent(userId: string, limit: number): Promise<FinanceEntry[]> {
    const rows = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: limit,
    });
    return rows.map(toFinanceEntry);
  }

  /**
   * Agregação no banco (`groupBy`), não "buscar tudo e somar em JS" —
   * "Performance: evitar consultas desnecessárias... preparar a
   * arquitetura para crescimento." Continua correto (e barato) mesmo
   * quando um usuário tiver dezenas de milhares de lançamentos.
   *
   * `TRANSFER` nunca entra na soma (`groupBy by: ['type']` só olha o que já
   * está no `where`, que nunca força `type: TRANSFER` aqui) — "transferência
   * não altera patrimônio total" continua verdade sem filtro extra.
   */
  async getSummary(userId: string, filter?: FinanceTransactionFilter): Promise<FinanceSummary> {
    const rows = await prisma.transaction.groupBy({
      by: ['type'],
      where: buildWhere(userId, filter),
      _sum: { amount: true },
    });

    const totalIncome = rows.find((row) => row.type === TransactionType.INCOME)?._sum.amount?.toNumber() ?? 0;
    const totalExpenses = rows.find((row) => row.type === TransactionType.EXPENSE)?._sum.amount?.toNumber() ?? 0;
    return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses };
  }

  async getCategoryBreakdown(
    userId: string,
    type: 'despesa' | 'receita',
    filter?: FinanceTransactionFilter
  ): Promise<FinanceCategoryBreakdownItem[]> {
    const where = buildWhere(userId, filter);
    where.type = toPersistedType(type);

    const rows = await prisma.transaction.groupBy({
      by: ['category'],
      where,
      _sum: { amount: true },
    });

    return rows
      .map((row) => ({ category: row.category ?? 'Outros', total: row._sum.amount?.toNumber() ?? 0 }))
      .sort((a, b) => b.total - a.total);
  }

  // --- Contas (CONTROL OS — Fase 7) ------------------------------------------

  async createAccount(userId: string, input: CreateFinanceAccountInput): Promise<FinanceAccount> {
    const row = await prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          userId,
          name: input.name,
          kind: toPersistedAccountKind(input.kind ?? 'outro'),
          currency: input.currency,
        },
      });

      // O saldo de abertura não é gravado em Account. Se for diferente de
      // zero, vira um lançamento técnico normal e participa de todo cálculo.
      const openingTransaction = input.initialBalanceCents !== 0
        ? await tx.transaction.create({
          data: {
            userId,
            accountId: account.id,
            type: input.initialBalanceCents > 0 ? TransactionType.INCOME : TransactionType.EXPENSE,
            origin: TransactionOrigin.ACCOUNT_OPENING_BALANCE,
            amount: new Prisma.Decimal(Math.abs(input.initialBalanceCents) / 100),
            description: 'Saldo inicial da conta',
            category: 'Saldo inicial',
            date: new Date(input.openingBalanceDate),
          },
        })
        : undefined;

      await tx.financeAuditEvent.create({
        data: {
          userId,
          actorUserId: userId,
          operation: 'account.created',
          source: input.source,
          entityType: 'account',
          entityId: account.id,
          after: {
            ...accountAuditSnapshot(account),
            initialBalanceCents: input.initialBalanceCents,
            openingBalanceDate: input.openingBalanceDate,
          },
        },
      });
      if (openingTransaction) {
        await tx.financeAuditEvent.create({
          data: {
            userId,
            actorUserId: userId,
            operation: 'transaction.account_opening_balance.created',
            source: input.source,
            entityType: 'transaction',
            entityId: openingTransaction.id,
            after: {
              id: openingTransaction.id,
              accountId: account.id,
              type: openingTransaction.type,
              origin: openingTransaction.origin,
              amount: openingTransaction.amount.toNumber(),
              date: openingTransaction.date.toISOString(),
            },
          },
        });
      }
      return account;
    });
    return toFinanceAccount(row);
  }

  async listAccounts(userId: string, options?: { includeArchived?: boolean }): Promise<FinanceAccount[]> {
    const rows = await prisma.account.findMany({
      where: { userId, ...(options?.includeArchived ? {} : { status: AccountStatus.ACTIVE }) },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toFinanceAccount);
  }

  async findAccountById(userId: string, id: string): Promise<FinanceAccount | undefined> {
    const row = await prisma.account.findFirst({ where: { id, userId } });
    return row ? toFinanceAccount(row) : undefined;
  }

  async findAccountByName(userId: string, name: string): Promise<FinanceAccount | undefined> {
    // Postgres `mode: 'insensitive'` — "Nubank" e "nubank" resolvem pra mesma conta, mesmo comportamento de `InMemoryFinanceRepository` (comparação com `.toLowerCase()`).
    const row = await prisma.account.findFirst({ where: { userId, name: { equals: name, mode: 'insensitive' } } });
    return row ? toFinanceAccount(row) : undefined;
  }

  async updateAccount(userId: string, input: UpdateFinanceAccountInput): Promise<FinanceAccount | undefined> {
    return prisma.$transaction(async (tx) => {
      const before = await tx.account.findFirst({ where: { id: input.id, userId } });
      if (!before) return undefined;
      const after = await tx.account.update({
        where: { id: input.id },
        data: { name: input.name, currency: input.currency },
      });
      await tx.financeAuditEvent.create({
        data: {
          userId,
          actorUserId: userId,
          operation: 'account.updated',
          source: input.source,
          entityType: 'account',
          entityId: after.id,
          before: accountAuditSnapshot(before),
          after: accountAuditSnapshot(after),
        },
      });
      return toFinanceAccount(after);
    });
  }

  async setAccountStatus(userId: string, input: SetFinanceAccountStatusInput): Promise<FinanceAccount | undefined> {
    return prisma.$transaction(async (tx) => {
      const before = await tx.account.findFirst({ where: { id: input.id, userId } });
      if (!before) return undefined;
      const after = await tx.account.update({
        where: { id: input.id },
        data: { status: input.status === 'arquivada' ? AccountStatus.ARCHIVED : AccountStatus.ACTIVE, archivedAt: input.status === 'arquivada' ? new Date() : null },
      });
      await tx.financeAuditEvent.create({
        data: {
          userId,
          actorUserId: userId,
          operation: input.status === 'arquivada' ? 'account.archived' : 'account.restored',
          source: input.source,
          entityType: 'account',
          entityId: after.id,
          before: accountAuditSnapshot(before),
          after: accountAuditSnapshot(after),
        },
      });
      return toFinanceAccount(after);
    });
  }

  async hasAccountMovements(userId: string, accountId: string): Promise<boolean> {
    return (await prisma.transaction.count({ where: { userId, accountId } })) > 0;
  }

  /**
   * `groupBy by: ['type', 'transferDirection']` filtrado por `accountId` —
   * no máximo 4 grupos (`INCOME`, `EXPENSE`, `TRANSFER`+`IN`, `TRANSFER`+
   * `OUT`), combinados com sinal em JS. Uma única consulta, nunca "buscar
   * todos os lançamentos da conta e somar" (que não escalaria).
   */
  async getAccountBalance(userId: string, accountId: string): Promise<number> {
    const rows = await prisma.transaction.groupBy({
      by: ['type', 'transferDirection'],
      where: { userId, accountId },
      _sum: { amount: true },
    });
    return rows.reduce((sum, row) => sum + signedGroupTotal(row.type, row.transferDirection, row._sum.amount), 0);
  }

  /**
   * Saldo de TODAS as contas numa única consulta agregada (`groupBy by:
   * ['accountId', 'type', 'transferDirection']`) — nunca N+1 (uma query
   * por conta). Combinado com `listAccounts` (para nome/ordem) em memória.
   */
  async listAccountBalances(userId: string): Promise<FinanceAccountBalance[]> {
    const [accounts, rows] = await Promise.all([
      prisma.account.findMany({ where: { userId, status: AccountStatus.ACTIVE }, orderBy: { createdAt: 'asc' } }),
      prisma.transaction.groupBy({
        by: ['accountId', 'type', 'transferDirection'],
        where: { userId },
        _sum: { amount: true },
      }),
    ]);

    return accounts.map((account) => ({
      accountId: account.id,
      accountName: account.name,
      balance: rows
        .filter((row) => row.accountId === account.id)
        .reduce((sum, row) => sum + signedGroupTotal(row.type, row.transferDirection, row._sum.amount), 0),
    }));
  }

  // --- Categorias -------------------------------------------------------------

  async createCategory(userId: string, input: CreateFinanceCategoryInput): Promise<FinanceCategory> {
    return prisma.$transaction(async (tx) => {
      const row = await tx.category.create({ data: { userId, name: input.name, kind: toPersistedType(input.kind), icon: input.icon, color: input.color, sortOrder: input.sortOrder ?? 0, isFavorite: input.isFavorite ?? false } });
      await tx.financeAuditEvent.create({ data: { userId, actorUserId: userId, operation: 'category.created', source: 'manual', entityType: 'category', entityId: row.id, after: categoryAuditSnapshot(row) } });
      return toFinanceCategory(row);
    });
  }

  async listCategories(userId: string, options?: { includeArchived?: boolean }): Promise<FinanceCategory[]> {
    const rows = await prisma.category.findMany({ where: { userId, ...(options?.includeArchived ? {} : { status: CategoryStatus.ACTIVE }) }, orderBy: [{ status: 'asc' }, { isFavorite: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }] });
    return rows.map(toFinanceCategory);
  }

  async findCategoryById(userId: string, id: string): Promise<FinanceCategory | undefined> {
    const row = await prisma.category.findFirst({ where: { id, userId } });
    return row ? toFinanceCategory(row) : undefined;
  }

  async findCategoryByName(userId: string, name: string): Promise<FinanceCategory | undefined> {
    const row = await prisma.category.findFirst({ where: { userId, name: { equals: name, mode: 'insensitive' } } });
    return row ? toFinanceCategory(row) : undefined;
  }

  async updateCategory(userId: string, input: UpdateFinanceCategoryInput): Promise<FinanceCategory | undefined> {
    return prisma.$transaction(async (tx) => {
      const before = await tx.category.findFirst({ where: { id: input.id, userId } });
      if (!before) return undefined;
      const after = await tx.category.update({ where: { id: input.id }, data: { name: input.name, icon: input.icon, color: input.color, sortOrder: input.sortOrder, isFavorite: input.isFavorite } });
      await tx.financeAuditEvent.create({ data: { userId, actorUserId: userId, operation: 'category.updated', source: input.source, entityType: 'category', entityId: after.id, before: categoryAuditSnapshot(before), after: categoryAuditSnapshot(after) } });
      return toFinanceCategory(after);
    });
  }

  async setCategoryStatus(userId: string, input: SetFinanceCategoryStatusInput): Promise<FinanceCategory | undefined> {
    return prisma.$transaction(async (tx) => {
      const before = await tx.category.findFirst({ where: { id: input.id, userId } });
      if (!before) return undefined;
      const after = await tx.category.update({ where: { id: input.id }, data: { status: input.status === 'arquivada' ? CategoryStatus.ARCHIVED : CategoryStatus.ACTIVE, archivedAt: input.status === 'arquivada' ? new Date() : null } });
      await tx.financeAuditEvent.create({ data: { userId, actorUserId: userId, operation: input.status === 'arquivada' ? 'category.archived' : 'category.restored', source: input.source, entityType: 'category', entityId: after.id, before: categoryAuditSnapshot(before), after: categoryAuditSnapshot(after) } });
      return toFinanceCategory(after);
    });
  }

  async hasCategoryTransactions(userId: string, categoryId: string): Promise<boolean> {
    return (await prisma.transaction.count({ where: { userId, categoryId } })) > 0;
  }
}

// --- Conversões domínio ↔ Prisma --------------------------------------------

function toPersistedType(type: FinanceEntryType): TransactionType {
  if (type === 'receita') return TransactionType.INCOME;
  if (type === 'despesa') return TransactionType.EXPENSE;
  return TransactionType.TRANSFER;
}

function fromPersistedType(type: TransactionType): FinanceEntryType {
  if (type === TransactionType.INCOME) return 'receita';
  if (type === TransactionType.EXPENSE) return 'despesa';
  return 'transferencia';
}

function toPersistedDirection(direction: FinanceTransferDirection): TransferDirection {
  return direction === 'entrada' ? TransferDirection.IN : TransferDirection.OUT;
}

function fromPersistedDirection(direction: TransferDirection | null): FinanceTransferDirection | undefined {
  if (direction === null) return undefined;
  return direction === TransferDirection.IN ? 'entrada' : 'saida';
}

function toPersistedAccountKind(kind: FinanceAccountKind): AccountKind {
  switch (kind) {
    case 'carteira':
      return AccountKind.CARTEIRA;
    case 'conta_corrente':
      return AccountKind.CONTA_CORRENTE;
    case 'poupanca':
      return AccountKind.POUPANCA;
    case 'cartao_credito':
      return AccountKind.CARTAO_CREDITO;
    default:
      return AccountKind.OUTRO;
  }
}

function fromPersistedAccountKind(kind: AccountKind): FinanceAccountKind {
  switch (kind) {
    case AccountKind.CARTEIRA:
      return 'carteira';
    case AccountKind.CONTA_CORRENTE:
      return 'conta_corrente';
    case AccountKind.POUPANCA:
      return 'poupanca';
    case AccountKind.CARTAO_CREDITO:
      return 'cartao_credito';
    default:
      return 'outro';
  }
}

function accountAuditSnapshot(account: PrismaAccountRow): Prisma.InputJsonObject {
  return {
    id: account.id,
    name: account.name,
    kind: String(account.kind),
    currency: account.currency,
    status: String(account.status),
    archivedAt: account.archivedAt?.toISOString() ?? null,
  };
}

/** `type`/`recurrenceFrequency` já chegam validados pelo `FinanceService` — este repositório só traduz formato, nunca decide regra de negócio (ex.: qual conta usar quando nenhuma foi informada). */
function toCreateData(userId: string, input: CreateFinanceTransactionInput): Prisma.TransactionUncheckedCreateInput {
  return {
    userId,
    type: toPersistedType(input.type),
    amount: new Prisma.Decimal(input.amount),
    description: input.description,
    category: input.category,
    categoryId: input.categoryId,
    date: input.date ? new Date(input.date) : undefined,
    accountId: input.accountId,
    transferGroupId: input.transferGroupId,
    transferDirection: input.transferDirection ? toPersistedDirection(input.transferDirection) : undefined,
    installmentGroupId: input.installmentGroupId,
    installmentNumber: input.installmentNumber,
    installmentTotal: input.installmentTotal,
    recurrenceRule: input.recurrenceFrequency,
  };
}

function buildWhere(userId: string, filter?: FinanceTransactionFilter): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId };
  if (filter?.type) {
    where.type = toPersistedType(filter.type);
  }
  if (filter?.accountId) {
    where.accountId = filter.accountId;
  }
  if (filter?.from || filter?.to) {
    where.date = {
      ...(filter.from ? { gte: new Date(filter.from) } : {}),
      ...(filter.to ? { lte: new Date(filter.to) } : {}),
    };
  }
  return where;
}

/**
 * Contribuição assinada de UM grupo (`groupBy by: ['type', 'transferDirection']`
 * ou `['accountId', 'type', 'transferDirection']`) pro saldo de uma conta —
 * mesma convenção de sinal de `InMemoryFinanceRepository.signedAmount`, só
 * que já somada por grupo (`_sum.amount`) em vez de lançamento a
 * lançamento.
 */
function signedGroupTotal(
  type: TransactionType,
  transferDirection: TransferDirection | null,
  sumAmount: Prisma.Decimal | null
): number {
  const total = sumAmount?.toNumber() ?? 0;
  if (type === TransactionType.INCOME) return total;
  if (type === TransactionType.EXPENSE) return -total;
  return fromPersistedDirection(transferDirection) === 'entrada' ? total : -total;
}

/** Borda do repositório: `Transaction` (Prisma, `Decimal`/`Date`/nulos) → `FinanceEntry` (domínio, `@control-os/types` — `number`/`string` ISO/sempre presente). Nenhuma camada acima desta função conhece a diferença. */
function toFinanceEntry(row: PrismaTransactionRow): FinanceEntry {
  return {
    id: row.id,
    type: fromPersistedType(row.type),
    description: row.description ?? '',
    amount: row.amount.toNumber(),
    category: row.category ?? 'Outros',
    categoryId: row.categoryId ?? undefined,
    date: row.date.toISOString(),
    accountId: row.accountId ?? undefined,
    transferGroupId: row.transferGroupId ?? undefined,
    transferDirection: fromPersistedDirection(row.transferDirection),
    installmentGroupId: row.installmentGroupId ?? undefined,
    installmentNumber: row.installmentNumber ?? undefined,
    installmentTotal: row.installmentTotal ?? undefined,
    recurrenceFrequency:
      row.recurrenceRule === 'mensal' || row.recurrenceRule === 'semanal' || row.recurrenceRule === 'anual'
        ? row.recurrenceRule
        : undefined,
  };
}

function toFinanceAccount(row: PrismaAccountRow): FinanceAccount {
  return {
    id: row.id,
    name: row.name,
    kind: fromPersistedAccountKind(row.kind),
    currency: row.currency,
    status: row.status === AccountStatus.ARCHIVED ? 'arquivada' : 'ativa',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString(),
  };
}

function toFinanceCategory(row: PrismaCategoryRow): FinanceCategory {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind ? fromPersistedType(row.kind) : undefined,
    icon: row.icon,
    color: row.color,
    status: row.status === CategoryStatus.ARCHIVED ? 'arquivada' : 'ativa',
    sortOrder: row.sortOrder,
    isFavorite: row.isFavorite,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString(),
  };
}

function categoryAuditSnapshot(row: PrismaCategoryRow): Prisma.InputJsonObject {
  return { id: row.id, name: row.name, kind: row.kind, icon: row.icon, color: row.color, status: row.status, sortOrder: row.sortOrder, isFavorite: row.isFavorite, archivedAt: row.archivedAt?.toISOString() ?? null };
}
