import { AccountKind, AccountStatus, CategoryStatus, FixedAccountOccurrenceStatus, FixedAccountPaymentMethod, FixedAccountRecurrence, Prisma, TransactionOrigin, TransactionSource, TransactionStatus, TransactionType, TransferDirection } from '@prisma/client';
import type { Account as PrismaAccountRow, Category as PrismaCategoryRow, FixedAccount as PrismaFixedAccountRow, FixedAccountOccurrence as PrismaFixedOccurrenceRow, Transaction as PrismaTransactionRow } from '@prisma/client';
import type {
  FinanceAccount,
  FinanceAccountKind,
  FinanceCategory,
  FinanceEntry, FixedAccount, FixedAccountOccurrence,
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
  TransactionAuditCommand,
  CreateFixedAccountRepositoryInput, UpdateFixedAccountRepositoryInput,
  FixedAccountOccurrenceFilter, CreateFixedAccountOccurrenceInput,
  FixedAccountOccurrenceSettlementInput,
  FinanceAuditSource,
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

  async createWithAudit(userId: string, input: CreateFinanceTransactionInput, audit: TransactionAuditCommand): Promise<FinanceEntry> {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({ data: toCreateData(userId, input) });
      await createTransactionAudit(tx, userId, created, audit, 'after');
      return created;
    });
    return toFinanceEntry(row);
  }

  async createManyWithAudit(userId: string, inputs: CreateFinanceTransactionInput[], audit: TransactionAuditCommand): Promise<FinanceEntry[]> {
    const rows = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const input of inputs) created.push(await tx.transaction.create({ data: toCreateData(userId, input) }));
      for (const row of created) await createTransactionAudit(tx, userId, row, audit, 'after');
      return created;
    });
    return rows.map(toFinanceEntry);
  }

  async updateWithAudit(userId: string, input: UpdateFinanceTransactionInput, audit: TransactionAuditCommand): Promise<FinanceEntry | undefined> {
    const row = await prisma.$transaction(async (tx) => {
      const before = await tx.transaction.findFirst({ where: { id: input.id, userId } });
      if (!before) return undefined;
      const after = await tx.transaction.update({ where: { id: input.id }, data: toUpdateData(input) });
      await createTransactionAudit(tx, userId, after, audit, 'after', before);
      return after;
    });
    return row ? toFinanceEntry(row) : undefined;
  }

  async transitionWithAudit(userId: string, id: string, status: import('@control-os/types').FinanceTransactionStatus, audit: TransactionAuditCommand): Promise<FinanceEntry | undefined> {
    const row = await prisma.$transaction(async (tx) => {
      const before = await tx.transaction.findFirst({ where: { id, userId } });
      if (!before) return undefined;
      const now = new Date();
      const after = await tx.transaction.update({ where: { id }, data: {
        status: toPersistedStatus(status),
        confirmedAt: status === 'confirmada' ? now : before.confirmedAt,
        paidAt: status === 'confirmada' ? (before.paidAt ?? now) : before.paidAt,
        canceledAt: status === 'cancelada' ? now : before.canceledAt,
      } });
      await createTransactionAudit(tx, userId, after, audit, 'after', before);
      return after;
    });
    return row ? toFinanceEntry(row) : undefined;
  }

  async reverseWithAudit(userId: string, originals: FinanceEntry[], reversals: CreateFinanceTransactionInput[], audit: TransactionAuditCommand): Promise<FinanceEntry[] | undefined> {
    const rows = await prisma.$transaction(async (tx) => {
      const before = await tx.transaction.findMany({ where: { userId, id: { in: originals.map((entry) => entry.id) } } });
      if (before.length !== originals.length) return undefined;
      const changed = [];
      for (const original of before) {
        const after = await tx.transaction.update({ where: { id: original.id }, data: { status: TransactionStatus.REVERSED } });
        await createTransactionAudit(tx, userId, after, audit, 'after', original);
        changed.push(after);
      }
      const created = [];
      for (const input of reversals) {
        const row = await tx.transaction.create({ data: toCreateData(userId, input) });
        await createTransactionAudit(tx, userId, row, { ...audit, operation: 'transaction.reversal.created' }, 'after');
        created.push(row);
      }
      return [...changed, ...created];
    });
    return rows?.map(toFinanceEntry);
  }

  async findByIdempotencyKey(userId: string, key: string): Promise<FinanceEntry | undefined> {
    const row = await prisma.transaction.findFirst({ where: { userId, idempotencyKey: key } });
    return row ? toFinanceEntry(row) : undefined;
  }

  async update(userId: string, input: UpdateFinanceTransactionInput): Promise<FinanceEntry | undefined> {
    const existing = await prisma.transaction.findFirst({ where: { id: input.id, userId } });
    if (!existing) return undefined;

    const row = await prisma.transaction.update({
      where: { id: input.id },
      data: toUpdateData(input),
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
    const where = buildWhere(userId, filter);
    where.status = TransactionStatus.CONFIRMED;
    const rows = await prisma.transaction.groupBy({
      by: ['type'],
      where,
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
    where.status = TransactionStatus.CONFIRMED;

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
      where: { userId, accountId, status: TransactionStatus.CONFIRMED },
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
        where: { userId, status: TransactionStatus.CONFIRMED },
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

  async createFixedAccount(userId: string, input: CreateFixedAccountRepositoryInput): Promise<FixedAccount> {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.fixedAccount.create({ data: fixedAccountData(userId, input) });
      await tx.financeAuditEvent.create({ data: { userId, actorUserId: userId, operation: 'fixed_account.created', source: input.source, entityType: 'fixed_account', entityId: created.id, after: fixedAccountSnapshot(created) } });
      return created;
    });
    return toFixedAccount(row);
  }

  async listFixedAccounts(userId: string, options?: { includeArchived?: boolean }): Promise<FixedAccount[]> {
    const rows = await prisma.fixedAccount.findMany({ where: { userId, ...(options?.includeArchived ? {} : { archivedAt: null }) }, orderBy: [{ active: 'desc' }, { name: 'asc' }] });
    return rows.map(toFixedAccount);
  }

  async findFixedAccountById(userId: string, id: string): Promise<FixedAccount | undefined> {
    const row = await prisma.fixedAccount.findFirst({ where: { id, userId } });
    return row ? toFixedAccount(row) : undefined;
  }

  async updateFixedAccount(userId: string, input: UpdateFixedAccountRepositoryInput): Promise<FixedAccount | undefined> {
    const row = await prisma.$transaction(async (tx) => {
      const before = await tx.fixedAccount.findFirst({ where: { id: input.id, userId } });
      if (!before) return undefined;
      const after = await tx.fixedAccount.update({ where: { id: input.id }, data: fixedAccountUpdateData(input) });
      await tx.financeAuditEvent.create({ data: { userId, actorUserId: userId, operation: 'fixed_account.updated', source: input.source, entityType: 'fixed_account', entityId: after.id, before: fixedAccountSnapshot(before), after: fixedAccountSnapshot(after) } });
      return after;
    });
    return row ? toFixedAccount(row) : undefined;
  }

  async setFixedAccountArchived(userId: string, id: string, archived: boolean, source: FinanceAuditSource): Promise<FixedAccount | undefined> {
    const row = await prisma.$transaction(async (tx) => {
      const before = await tx.fixedAccount.findFirst({ where: { id, userId } });
      if (!before) return undefined;
      const after = await tx.fixedAccount.update({ where: { id }, data: { active: archived ? false : true, archivedAt: archived ? new Date() : null } });
      await tx.financeAuditEvent.create({ data: { userId, actorUserId: userId, operation: archived ? 'fixed_account.archived' : 'fixed_account.restored', source, entityType: 'fixed_account', entityId: id, before: fixedAccountSnapshot(before), after: fixedAccountSnapshot(after) } });
      return after;
    });
    return row ? toFixedAccount(row) : undefined;
  }

  async createFixedAccountOccurrences(userId: string, rows: CreateFixedAccountOccurrenceInput[], source: FinanceAuditSource): Promise<FixedAccountOccurrence[]> {
    if (!rows.length) return [];
    return prisma.$transaction(async (tx) => {
      const created: PrismaFixedOccurrenceRow[] = [];
      for (const input of rows) {
        try {
          const row = await tx.fixedAccountOccurrence.create({ data: occurrenceData(input) });
          created.push(row);
          await tx.financeAuditEvent.create({ data: { userId, actorUserId: userId, operation: 'OCCURRENCE_GENERATED', source, entityType: 'fixed_account_occurrence', entityId: row.id, after: occurrenceSnapshot(row) } });
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
        }
      }
      const fixedAccountId = rows[0]?.fixedAccountId;
      if (created.length && fixedAccountId) await tx.fixedAccount.updateMany({ where: { id: fixedAccountId, userId }, data: { lastGeneratedCompetence: created.map((row) => row.referencePeriod).sort().at(-1) } });
      return created.map((row) => toFixedAccountOccurrence(row));
    });
  }

  async listFixedAccountOccurrences(userId: string, filter?: FixedAccountOccurrenceFilter): Promise<FixedAccountOccurrence[]> {
    const now = new Date();
    const rows = await prisma.fixedAccountOccurrence.findMany({ where: { fixedAccount: { userId }, ...(filter?.fixedAccountId ? { fixedAccountId: filter.fixedAccountId } : {}), ...(filter?.competence ? (() => { const [year, month] = filter.competence.split('-').map(Number); return { competenceYear: year, competenceMonth: month }; })() : {}), ...(filter?.from || filter?.to ? { dueDate: { ...(filter.from ? { gte: new Date(filter.from) } : {}), ...(filter.to ? { lte: new Date(filter.to) } : {}) } } : {}) }, include: { payments: true }, orderBy: { dueDate: 'asc' } });
    return rows.map((row) => toFixedAccountOccurrence(row, now)).filter((row) => !filter?.status || row.displayStatus === filter.status);
  }

  async findFixedAccountOccurrenceById(userId: string, id: string): Promise<FixedAccountOccurrence | undefined> {
    const row = await prisma.fixedAccountOccurrence.findFirst({ where: { id, fixedAccount: { userId } }, include: { payments: true } });
    return row ? toFixedAccountOccurrence(row) : undefined;
  }

  async recordFixedAccountOccurrencePayment(userId: string, input: FixedAccountOccurrenceSettlementInput): Promise<{ occurrence: FixedAccountOccurrence; transaction: FinanceEntry } | undefined> {
    return prisma.$transaction(async (tx) => {
      const occurrence = await tx.fixedAccountOccurrence.findFirst({ where: { id: input.occurrenceId, fixedAccount: { userId } }, include: { payments: true } });
      if (!occurrence || occurrence.status === FixedAccountOccurrenceStatus.CANCELLED || occurrence.status === FixedAccountOccurrenceStatus.PAID) return undefined;
      if (input.idempotencyKey) {
        const existing = await tx.transaction.findFirst({ where: { userId, idempotencyKey: input.idempotencyKey } });
        if (existing) return { occurrence: toFixedAccountOccurrence(occurrence), transaction: toFinanceEntry(existing) };
      }
      const paid = occurrence.payments.reduce((sum, payment) => sum + payment.amount.toNumber(), 0);
      if (input.amount <= 0 || input.amount > occurrence.amount.toNumber() - paid + 0.00001) throw new Error('Valor de pagamento inválido para esta ocorrência.');
      const transaction = await tx.transaction.create({ data: toCreateData(userId, input.transaction) });
      await tx.fixedAccountOccurrencePayment.create({ data: { occurrenceId: occurrence.id, transactionId: transaction.id, amount: new Prisma.Decimal(input.amount) } });
      const total = paid + input.amount;
      const fullyPaid = total >= occurrence.amount.toNumber() - 0.00001;
      const updated = await tx.fixedAccountOccurrence.update({ where: { id: occurrence.id }, data: { status: fullyPaid ? FixedAccountOccurrenceStatus.PAID : FixedAccountOccurrenceStatus.PARTIAL, paidAt: fullyPaid ? new Date() : null, transactionId: transaction.id } });
      await createTransactionAudit(tx, userId, transaction, { operation: 'transaction.created_from_fixed_occurrence', source: input.source }, 'after');
      await tx.financeAuditEvent.create({ data: { userId, actorUserId: userId, operation: fullyPaid ? 'OCCURRENCE_PAID' : 'OCCURRENCE_PARTIAL_PAID', source: input.source, entityType: 'fixed_account_occurrence', entityId: updated.id, before: occurrenceSnapshot(occurrence), after: occurrenceSnapshot(updated) } });
      return { occurrence: toFixedAccountOccurrence(updated), transaction: toFinanceEntry(transaction) };
    });
  }

  async cancelFixedAccountOccurrence(userId: string, id: string, source: FinanceAuditSource): Promise<FixedAccountOccurrence | undefined> {
    return prisma.$transaction(async (tx) => {
      const before = await tx.fixedAccountOccurrence.findFirst({ where: { id, fixedAccount: { userId } } });
      if (!before || before.status !== FixedAccountOccurrenceStatus.PENDING) return undefined;
      const after = await tx.fixedAccountOccurrence.update({ where: { id }, data: { status: FixedAccountOccurrenceStatus.CANCELLED } });
      await tx.financeAuditEvent.create({ data: { userId, actorUserId: userId, operation: 'OCCURRENCE_CANCELLED', source, entityType: 'fixed_account_occurrence', entityId: id, before: occurrenceSnapshot(before), after: occurrenceSnapshot(after) } });
      return toFixedAccountOccurrence(after);
    });
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

function toPersistedStatus(status: import('@control-os/types').FinanceTransactionStatus): TransactionStatus {
  return status === 'pendente' ? TransactionStatus.PENDING : status === 'confirmada' ? TransactionStatus.CONFIRMED : status === 'cancelada' ? TransactionStatus.CANCELED : TransactionStatus.REVERSED;
}

function fromPersistedStatus(status: TransactionStatus): import('@control-os/types').FinanceTransactionStatus {
  return status === TransactionStatus.PENDING ? 'pendente' : status === TransactionStatus.CONFIRMED ? 'confirmada' : status === TransactionStatus.CANCELED ? 'cancelada' : 'estornada';
}

function toPersistedSource(source: import('@control-os/types').FinanceTransactionSource | undefined): TransactionSource {
  return source === 'nova' ? TransactionSource.NOVA : source === 'whatsapp' ? TransactionSource.WHATSAPP : source === 'api' ? TransactionSource.API : TransactionSource.MANUAL;
}

function fromPersistedSource(source: TransactionSource): import('@control-os/types').FinanceTransactionSource {
  return source === TransactionSource.NOVA ? 'nova' : source === TransactionSource.WHATSAPP ? 'whatsapp' : source === TransactionSource.API ? 'api' : 'manual';
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
    status: toPersistedStatus(input.status ?? 'confirmada'),
    source: toPersistedSource(input.source),
    competenceDate: input.competenceDate ? new Date(input.competenceDate) : (input.date ? new Date(input.date) : undefined),
    dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
    paidAt: input.paidAt ? new Date(input.paidAt) : (input.status === 'confirmada' || !input.status ? new Date(input.date ?? Date.now()) : undefined),
    confirmedAt: input.confirmedAt ? new Date(input.confirmedAt) : (input.status === 'confirmada' || !input.status ? new Date() : undefined),
    canceledAt: input.canceledAt ? new Date(input.canceledAt) : undefined,
    idempotencyKey: input.idempotencyKey,
    idempotencyFingerprint: input.idempotencyFingerprint,
    correlationId: input.correlationId,
    reversalOfId: input.reversalOfId,
    accountId: input.accountId,
    transferGroupId: input.transferGroupId,
    transferDirection: input.transferDirection ? toPersistedDirection(input.transferDirection) : undefined,
    installmentGroupId: input.installmentGroupId,
    installmentNumber: input.installmentNumber,
    installmentTotal: input.installmentTotal,
    recurrenceRule: input.recurrenceFrequency,
  };
}

function toUpdateData(input: UpdateFinanceTransactionInput): Prisma.TransactionUncheckedUpdateInput {
  return {
    amount: input.amount !== undefined ? new Prisma.Decimal(input.amount) : undefined,
    description: input.description,
    category: input.category,
    categoryId: input.categoryId,
    date: input.date !== undefined ? new Date(input.date) : undefined,
    competenceDate: input.competenceDate !== undefined ? new Date(input.competenceDate) : undefined,
    dueDate: input.dueDate !== undefined ? new Date(input.dueDate) : undefined,
    accountId: input.accountId,
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
  if (filter?.status) {
    where.status = Array.isArray(filter.status) ? { in: filter.status.map(toPersistedStatus) } : toPersistedStatus(filter.status);
  }
  if (filter?.from || filter?.to) {
    where.date = {
      ...(filter.from ? { gte: new Date(filter.from) } : {}),
      ...(filter.to ? { lte: new Date(filter.to) } : {}),
    };
  }
  return where;
}

function transactionAuditSnapshot(row: PrismaTransactionRow): Prisma.InputJsonObject {
  return { id: row.id, type: String(row.type), amount: row.amount.toNumber(), accountId: row.accountId, categoryId: row.categoryId, status: String(row.status), date: row.date.toISOString(), competenceDate: row.competenceDate?.toISOString() ?? null, dueDate: row.dueDate?.toISOString() ?? null, paidAt: row.paidAt?.toISOString() ?? null, reversalOfId: row.reversalOfId, idempotencyKey: row.idempotencyKey };
}

async function createTransactionAudit(tx: Prisma.TransactionClient, userId: string, after: PrismaTransactionRow, audit: TransactionAuditCommand, state: 'after', before?: PrismaTransactionRow): Promise<void> {
  await tx.financeAuditEvent.create({ data: { userId, actorUserId: userId, operation: audit.operation, source: audit.source, entityType: 'transaction', entityId: after.id, before: before ? transactionAuditSnapshot(before) : undefined, after: state === 'after' ? transactionAuditSnapshot(after) : undefined, correlationId: audit.correlationId } });
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
    status: fromPersistedStatus(row.status),
    competenceDate: row.competenceDate?.toISOString(),
    dueDate: row.dueDate?.toISOString(),
    paidAt: row.paidAt?.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString(),
    canceledAt: row.canceledAt?.toISOString(),
    reversalOfId: row.reversalOfId ?? undefined,
    idempotencyKey: row.idempotencyKey ?? undefined,
    correlationId: row.correlationId ?? undefined,
    source: fromPersistedSource(row.source),
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

function toFixedAccount(row: PrismaFixedAccountRow): FixedAccount {
  return { id: row.id, name: row.name, description: row.description ?? undefined, type: row.type === TransactionType.INCOME ? 'receita' : 'despesa', categoryId: row.categoryId, sourceAccountId: row.sourceAccountId ?? undefined, destinationAccountId: row.destinationAccountId ?? undefined, paymentMethod: fromFixedPaymentMethod(row.paymentMethod), amount: row.amount.toNumber(), recurrence: fromFixedRecurrence(row.recurrence), customIntervalDays: row.customIntervalDays ?? undefined, dueDay: row.dueDay, startDate: row.startDate.toISOString(), endDate: row.endDate?.toISOString(), active: row.active, archivedAt: row.archivedAt?.toISOString(), lastGeneratedCompetence: row.lastGeneratedCompetence ?? undefined, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

function toFixedAccountOccurrence(row: PrismaFixedOccurrenceRow & { payments?: Array<{ amount: Prisma.Decimal }> }, now = new Date()): FixedAccountOccurrence {
  const status = row.status === FixedAccountOccurrenceStatus.PAID ? 'paga' : row.status === FixedAccountOccurrenceStatus.PARTIAL ? 'parcial' : row.status === FixedAccountOccurrenceStatus.CANCELLED ? 'cancelada' : 'pendente';
  const displayStatus = status === 'pendente' && row.dueDate < now ? 'atrasada' : status;
  return { id: row.id, fixedAccountId: row.fixedAccountId, competenceMonth: row.competenceMonth, competenceYear: row.competenceYear, referencePeriod: row.referencePeriod, dueDate: row.dueDate.toISOString(), name: row.name, description: row.description ?? undefined, type: row.type === TransactionType.INCOME ? 'receita' : 'despesa', categoryId: row.categoryId, paymentMethod: fromFixedPaymentMethod(row.paymentMethod), sourceAccountId: row.sourceAccountId ?? undefined, destinationAccountId: row.destinationAccountId ?? undefined, amount: row.amount.toNumber(), status, displayStatus, paidAmount: row.payments?.reduce((sum, payment) => sum + payment.amount.toNumber(), 0) ?? (status === 'paga' ? row.amount.toNumber() : 0), transactionId: row.transactionId ?? undefined, paidAt: row.paidAt?.toISOString(), reconciliationStatus: row.reconciliationStatus === 'MATCHED' ? 'conciliada' : row.reconciliationStatus === 'REVIEW_REQUIRED' ? 'revisar' : undefined, externalReferenceId: row.externalReferenceId ?? undefined, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

function fixedAccountData(userId: string, input: CreateFixedAccountRepositoryInput): Prisma.FixedAccountUncheckedCreateInput {
  return { userId, name: input.name.trim(), description: input.description?.trim() || null, type: input.type === 'receita' ? TransactionType.INCOME : TransactionType.EXPENSE, categoryId: input.categoryId, sourceAccountId: input.sourceAccountId ?? null, destinationAccountId: input.destinationAccountId ?? null, paymentMethod: toFixedPaymentMethod(input.paymentMethod), amount: new Prisma.Decimal(input.amount), recurrence: toFixedRecurrence(input.recurrence), customIntervalDays: input.customIntervalDays ?? null, dueDay: input.dueDay, startDate: new Date(input.startDate), endDate: input.endDate ? new Date(input.endDate) : null };
}

function fixedAccountUpdateData(input: UpdateFixedAccountRepositoryInput): Prisma.FixedAccountUncheckedUpdateInput {
  if (input.type !== undefined) {
    return {
      ...fixedAccountUpdateData({ ...input, type: undefined }),
      type: input.type === 'receita' ? TransactionType.INCOME : TransactionType.EXPENSE,
    };
  }
  return { ...(input.name !== undefined ? { name: input.name.trim() } : {}), ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}), ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}), ...(input.sourceAccountId !== undefined ? { sourceAccountId: input.sourceAccountId ?? null } : {}), ...(input.destinationAccountId !== undefined ? { destinationAccountId: input.destinationAccountId ?? null } : {}), ...(input.paymentMethod !== undefined ? { paymentMethod: toFixedPaymentMethod(input.paymentMethod) } : {}), ...(input.amount !== undefined ? { amount: new Prisma.Decimal(input.amount) } : {}), ...(input.recurrence !== undefined ? { recurrence: toFixedRecurrence(input.recurrence) } : {}), ...(input.customIntervalDays !== undefined ? { customIntervalDays: input.customIntervalDays ?? null } : {}), ...(input.dueDay !== undefined ? { dueDay: input.dueDay } : {}), ...(input.startDate !== undefined ? { startDate: new Date(input.startDate) } : {}), ...(input.endDate !== undefined ? { endDate: input.endDate ? new Date(input.endDate) : null } : {}), ...(input.active !== undefined ? { active: input.active } : {}) };
}

function occurrenceData(input: CreateFixedAccountOccurrenceInput): Prisma.FixedAccountOccurrenceUncheckedCreateInput {
  return { fixedAccountId: input.fixedAccountId, competenceMonth: input.competenceMonth, competenceYear: input.competenceYear, referencePeriod: input.referencePeriod, dueDate: new Date(input.dueDate), name: input.name, description: input.description ?? null, type: input.type === 'receita' ? TransactionType.INCOME : TransactionType.EXPENSE, categoryId: input.categoryId, paymentMethod: toFixedPaymentMethod(input.paymentMethod), sourceAccountId: input.sourceAccountId ?? null, destinationAccountId: input.destinationAccountId ?? null, amount: new Prisma.Decimal(input.amount) };
}

function fixedAccountSnapshot(row: PrismaFixedAccountRow): Prisma.InputJsonObject { return { ...toFixedAccount(row) } as Prisma.InputJsonObject; }
function occurrenceSnapshot(row: PrismaFixedOccurrenceRow): Prisma.InputJsonObject { return { id: row.id, fixedAccountId: row.fixedAccountId, referencePeriod: row.referencePeriod, amount: row.amount.toString(), status: row.status, dueDate: row.dueDate.toISOString(), transactionId: row.transactionId ?? null }; }
function toFixedRecurrence(value: import('@control-os/types').FixedAccountRecurrence): FixedAccountRecurrence { return value === 'mensal' ? FixedAccountRecurrence.MONTHLY : value === 'semanal' ? FixedAccountRecurrence.WEEKLY : value === 'anual' ? FixedAccountRecurrence.YEARLY : FixedAccountRecurrence.CUSTOM; }
function fromFixedRecurrence(value: FixedAccountRecurrence): import('@control-os/types').FixedAccountRecurrence { return value === FixedAccountRecurrence.MONTHLY ? 'mensal' : value === FixedAccountRecurrence.WEEKLY ? 'semanal' : value === FixedAccountRecurrence.YEARLY ? 'anual' : 'personalizada'; }
function toFixedPaymentMethod(value: import('@control-os/types').FixedAccountPaymentMethod): FixedAccountPaymentMethod { return value === 'conta_bancaria' ? FixedAccountPaymentMethod.BANK_ACCOUNT : value === 'cartao_credito' ? FixedAccountPaymentMethod.CREDIT_CARD : value === 'dinheiro' ? FixedAccountPaymentMethod.CASH : value === 'pix' ? FixedAccountPaymentMethod.PIX : value === 'boleto' ? FixedAccountPaymentMethod.BOLETO : FixedAccountPaymentMethod.OTHER; }
function fromFixedPaymentMethod(value: FixedAccountPaymentMethod): import('@control-os/types').FixedAccountPaymentMethod { return value === FixedAccountPaymentMethod.BANK_ACCOUNT ? 'conta_bancaria' : value === FixedAccountPaymentMethod.CREDIT_CARD ? 'cartao_credito' : value === FixedAccountPaymentMethod.CASH ? 'dinheiro' : value === FixedAccountPaymentMethod.PIX ? 'pix' : value === FixedAccountPaymentMethod.BOLETO ? 'boleto' : 'outro'; }
