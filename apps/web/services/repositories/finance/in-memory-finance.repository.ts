import type { FinanceAccount, FinanceCategory, FinanceEntry, FixedAccount, FixedAccountOccurrence } from '@control-os/types';
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
  CreateFixedAccountRepositoryInput, UpdateFixedAccountRepositoryInput, FixedAccountOccurrenceFilter, CreateFixedAccountOccurrenceInput, FixedAccountOccurrenceSettlementInput, FinanceAuditSource,
} from './finance-repository.types';

/**
 * `InMemoryFinanceRepository` — CONTROL OS Fase 6/Fase 7. "No futuro
 * existirão naturalmente: ... InMemoryRepository, TestRepository. Sem
 * alterar nenhum Service." Esta é essa implementação — guarda
 * `FinanceEntry`/`FinanceAccount`/`FinanceCategory` em `Map`s por `userId`,
 * sem nenhuma dependência de rede/banco.
 *
 * Dois usos: (1) os testes desta fase
 * (`__tests__/finance.service.test.ts`) — esta sandbox não tem acesso a um
 * Postgres de teste nem ao CLI do Prisma, então esta é a via real de
 * testar toda a lógica de `FinanceService` de ponta a ponta (contas,
 * categorias, transferências, parcelamentos, saldo, fluxo de caixa) sem
 * mock nenhum de rede; (2) sucessora direta do antigo `MockFinanceService`.
 */
let nextTransactionId = 1;
let nextAccountId = 1;
let nextCategoryId = 1;
let nextFixedAccountId = 1;
let nextOccurrenceId = 1;

function matchesFilter(entry: FinanceEntry, filter: FinanceTransactionFilter | undefined): boolean {
  if (!filter) return true;
  if (filter.type && entry.type !== filter.type) return false;
  if (filter.status && (Array.isArray(filter.status) ? !filter.status.includes(entry.status ?? 'confirmada') : entry.status !== filter.status)) return false;
  if (filter.from && entry.date < filter.from) return false;
  if (filter.to && entry.date > filter.to) return false;
  if (filter.accountId && entry.accountId !== filter.accountId) return false;
  return true;
}

/**
 * Contribuição assinada de UM lançamento pro saldo de uma conta —
 * `despesa` sai, `receita` entra, `transferencia` depende da perna
 * (`transferDirection`). Mesma convenção de sinal usada por
 * `PrismaFinanceRepository.getAccountBalance` — as duas implementações
 * precisam concordar, ou os testes (`InMemoryFinanceRepository`) deixariam
 * de significar algo sobre o comportamento real em produção.
 */
function signedAmount(entry: FinanceEntry): number {
  if (entry.status && entry.status !== 'confirmada') return 0;
  if (entry.type === 'receita') return entry.amount;
  if (entry.type === 'despesa') return -entry.amount;
  return entry.transferDirection === 'entrada' ? entry.amount : -entry.amount;
}

export class InMemoryFinanceRepository implements FinanceRepository {
  private readonly entriesByUser = new Map<string, FinanceEntry[]>();
  private readonly accountsByUser = new Map<string, FinanceAccount[]>();
  private readonly categoriesByUser = new Map<string, FinanceCategory[]>();
  private readonly auditEventsByUser = new Map<string, Array<Record<string, unknown>>>();
  private readonly fixedAccountsByUser = new Map<string, FixedAccount[]>();
  private readonly occurrencesByUser = new Map<string, FixedAccountOccurrence[]>();

  private entriesFor(userId: string): FinanceEntry[] {
    let entries = this.entriesByUser.get(userId);
    if (!entries) {
      entries = [];
      this.entriesByUser.set(userId, entries);
    }
    return entries;
  }

  private accountsFor(userId: string): FinanceAccount[] {
    let accounts = this.accountsByUser.get(userId);
    if (!accounts) {
      accounts = [];
      this.accountsByUser.set(userId, accounts);
    }
    return accounts;
  }

  private categoriesFor(userId: string): FinanceCategory[] {
    let categories = this.categoriesByUser.get(userId);
    if (!categories) {
      categories = [];
      this.categoriesByUser.set(userId, categories);
    }
    return categories;
  }

  private fixedAccountsFor(userId: string): FixedAccount[] { const rows = this.fixedAccountsByUser.get(userId) ?? []; this.fixedAccountsByUser.set(userId, rows); return rows; }
  private occurrencesFor(userId: string): FixedAccountOccurrence[] { const rows = this.occurrencesByUser.get(userId) ?? []; this.occurrencesByUser.set(userId, rows); return rows; }

  private audit(userId: string, event: Record<string, unknown>): void {
    const events = this.auditEventsByUser.get(userId) ?? [];
    events.push({ ...event, userId, actorUserId: userId, createdAt: new Date().toISOString() });
    this.auditEventsByUser.set(userId, events);
  }

  /** Suporte exclusivo aos testes de domínio; produção usa FinanceAuditEvent no PostgreSQL. */
  getAuditEventsForTest(userId: string): Array<Record<string, unknown>> {
    return [...(this.auditEventsByUser.get(userId) ?? [])];
  }

  /**
   * Preparação explícita para cenários legados de teste. Não é usada pela
   * aplicação: em produção uma conta só nasce pelo `FinanceService`, que
   * cria o lançamento de abertura e a auditoria de forma atômica.
   */
  seedAccountForTest(userId: string, name = 'Carteira'): FinanceAccount {
    const now = new Date().toISOString();
    const account: FinanceAccount = {
      id: `account_${nextAccountId++}`,
      name,
      kind: 'outro',
      currency: 'BRL',
      status: 'ativa',
      createdAt: now,
      updatedAt: now,
    };
    this.accountsFor(userId).push(account);
    return { ...account };
  }

  // --- Transações -------------------------------------------------------

  async create(userId: string, input: CreateFinanceTransactionInput): Promise<FinanceEntry> {
    const entry: FinanceEntry = {
      id: `finance_${nextTransactionId++}`,
      type: input.type,
      description:
        input.description ??
        (input.type === 'despesa'
          ? 'Despesa registrada'
          : input.type === 'transferencia'
            ? 'Transferência registrada'
            : 'Receita registrada'),
      amount: input.amount,
      category: input.category ?? 'Outros',
      categoryId: input.categoryId,
      date: input.date ?? new Date().toISOString(),
      accountId: input.accountId,
      transferGroupId: input.transferGroupId,
      transferDirection: input.transferDirection,
      installmentGroupId: input.installmentGroupId,
      installmentNumber: input.installmentNumber,
      installmentTotal: input.installmentTotal,
      recurrenceFrequency:
        input.recurrenceFrequency === 'mensal' || input.recurrenceFrequency === 'semanal' || input.recurrenceFrequency === 'anual'
          ? input.recurrenceFrequency
          : undefined,
      status: input.status ?? 'confirmada',
      source: input.source ?? 'manual',
      competenceDate: input.competenceDate ?? input.date ?? new Date().toISOString(),
      dueDate: input.dueDate,
      paidAt: input.paidAt ?? ((input.status ?? 'confirmada') === 'confirmada' ? input.date ?? new Date().toISOString() : undefined),
      confirmedAt: input.confirmedAt ?? ((input.status ?? 'confirmada') === 'confirmada' ? new Date().toISOString() : undefined),
      canceledAt: input.canceledAt,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      reversalOfId: input.reversalOfId,
    };
    this.entriesFor(userId).push(entry);
    return entry;
  }

  async createMany(userId: string, inputs: CreateFinanceTransactionInput[]): Promise<FinanceEntry[]> {
    const created: FinanceEntry[] = [];
    for (const input of inputs) {
      created.push(await this.create(userId, input));
    }
    return created;
  }

  async createWithAudit(userId: string, input: CreateFinanceTransactionInput, audit: TransactionAuditCommand): Promise<FinanceEntry> {
    const entry = await this.create(userId, input);
    this.audit(userId, { operation: audit.operation, source: audit.source, entityType: 'transaction', entityId: entry.id, after: { ...entry }, correlationId: audit.correlationId });
    return entry;
  }

  async createManyWithAudit(userId: string, inputs: CreateFinanceTransactionInput[], audit: TransactionAuditCommand): Promise<FinanceEntry[]> {
    const existing = [...this.entriesFor(userId)];
    try {
      const entries = await this.createMany(userId, inputs);
      for (const entry of entries) this.audit(userId, { operation: audit.operation, source: audit.source, entityType: 'transaction', entityId: entry.id, after: { ...entry }, correlationId: audit.correlationId });
      return entries;
    } catch (error) { this.entriesByUser.set(userId, existing); throw error; }
  }

  async updateWithAudit(userId: string, input: UpdateFinanceTransactionInput, audit: TransactionAuditCommand): Promise<FinanceEntry | undefined> {
    const before = await this.findById(userId, input.id);
    const entry = await this.update(userId, input);
    if (entry) this.audit(userId, { operation: audit.operation, source: audit.source, entityType: 'transaction', entityId: entry.id, before: before ? { ...before } : null, after: { ...entry }, correlationId: audit.correlationId });
    return entry;
  }

  async transitionWithAudit(userId: string, id: string, status: import('@control-os/types').FinanceTransactionStatus, audit: TransactionAuditCommand): Promise<FinanceEntry | undefined> {
    const entry = await this.findById(userId, id); if (!entry) return undefined;
    const before = { ...entry }; entry.status = status;
    if (status === 'confirmada') { entry.confirmedAt = new Date().toISOString(); entry.paidAt ??= entry.confirmedAt; }
    if (status === 'cancelada') entry.canceledAt = new Date().toISOString();
    this.audit(userId, { operation: audit.operation, source: audit.source, entityType: 'transaction', entityId: id, before, after: { ...entry }, correlationId: audit.correlationId });
    return entry;
  }

  async reverseWithAudit(userId: string, originals: FinanceEntry[], reversals: CreateFinanceTransactionInput[], audit: TransactionAuditCommand): Promise<FinanceEntry[] | undefined> {
    const all = this.entriesFor(userId); const snapshot = all.map((entry) => ({ ...entry }));
    if (originals.some((original) => !all.some((entry) => entry.id === original.id))) return undefined;
    try {
      for (const original of originals) await this.transitionWithAudit(userId, original.id, 'estornada', audit);
      const created = await this.createManyWithAudit(userId, reversals, { ...audit, operation: 'transaction.reversal.created' });
      return [...originals.map((original) => all.find((entry) => entry.id === original.id)!).filter(Boolean), ...created];
    } catch (error) { this.entriesByUser.set(userId, snapshot); throw error; }
  }

  async findByIdempotencyKey(userId: string, key: string): Promise<FinanceEntry | undefined> { return this.entriesFor(userId).find((entry) => entry.idempotencyKey === key); }

  async update(userId: string, input: UpdateFinanceTransactionInput): Promise<FinanceEntry | undefined> {
    const entry = this.entriesFor(userId).find((candidate) => candidate.id === input.id);
    if (!entry) return undefined;
    if (input.amount !== undefined) entry.amount = input.amount;
    if (input.description !== undefined) entry.description = input.description;
    if (input.category !== undefined) entry.category = input.category;
    if (input.categoryId !== undefined) entry.categoryId = input.categoryId;
    if (input.date !== undefined) entry.date = input.date;
    if (input.accountId !== undefined) entry.accountId = input.accountId;
    if (input.competenceDate !== undefined) entry.competenceDate = input.competenceDate;
    if (input.dueDate !== undefined) entry.dueDate = input.dueDate;
    return entry;
  }

  async delete(userId: string, id: string): Promise<FinanceEntry | undefined> {
    const entries = this.entriesFor(userId);
    const index = entries.findIndex((candidate) => candidate.id === id);
    if (index === -1) return undefined;
    const [removed] = entries.splice(index, 1);
    return removed;
  }

  async findById(userId: string, id: string): Promise<FinanceEntry | undefined> {
    return this.entriesFor(userId).find((candidate) => candidate.id === id);
  }

  async list(userId: string, filter?: FinanceTransactionFilter): Promise<FinanceEntry[]> {
    return this.entriesFor(userId).filter((entry) => matchesFilter(entry, filter));
  }

  async getRecent(userId: string, limit: number): Promise<FinanceEntry[]> {
    return [...this.entriesFor(userId)].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, limit);
  }

  async getSummary(userId: string, filter?: FinanceTransactionFilter): Promise<FinanceSummary> {
    const entries = await this.list(userId, filter);
    const realized = entries.filter((entry) => !entry.status || entry.status === 'confirmada');
    const totalIncome = realized.filter((entry) => entry.type === 'receita').reduce((sum, entry) => sum + entry.amount, 0);
    const totalExpenses = realized.filter((entry) => entry.type === 'despesa').reduce((sum, entry) => sum + entry.amount, 0);
    return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses };
  }

  async getCategoryBreakdown(
    userId: string,
    type: 'despesa' | 'receita',
    filter?: FinanceTransactionFilter
  ): Promise<FinanceCategoryBreakdownItem[]> {
    const entries = (await this.list(userId, filter)).filter((entry) => entry.type === type && (!entry.status || entry.status === 'confirmada'));
    const totals = new Map<string, number>();
    for (const entry of entries) {
      totals.set(entry.category, (totals.get(entry.category) ?? 0) + entry.amount);
    }
    return [...totals.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }

  // --- Contas -------------------------------------------------------------

  async createAccount(userId: string, input: CreateFinanceAccountInput): Promise<FinanceAccount> {
    const now = new Date().toISOString();
    const account: FinanceAccount = {
      id: `account_${nextAccountId++}`,
      name: input.name,
      kind: input.kind ?? 'outro',
      currency: input.currency,
      status: 'ativa',
      createdAt: now,
      updatedAt: now,
    };
    this.accountsFor(userId).push(account);
    const openingEntry = input.initialBalanceCents !== 0
      ? await this.create(userId, {
        type: input.initialBalanceCents > 0 ? 'receita' : 'despesa',
        amount: Math.abs(input.initialBalanceCents) / 100,
        description: 'Saldo inicial da conta',
        category: 'Saldo inicial',
        date: input.openingBalanceDate,
        accountId: account.id,
      })
      : undefined;
    this.audit(userId, {
      operation: 'account.created',
      source: input.source,
      entityType: 'account',
      entityId: account.id,
      after: { ...account, initialBalanceCents: input.initialBalanceCents, openingBalanceDate: input.openingBalanceDate },
    });
    if (openingEntry) {
      this.audit(userId, {
        operation: 'transaction.account_opening_balance.created',
        source: input.source,
        entityType: 'transaction',
        entityId: openingEntry.id,
        after: { ...openingEntry, origin: 'ACCOUNT_OPENING_BALANCE' },
      });
    }
    return account;
  }

  async listAccounts(userId: string, options?: { includeArchived?: boolean }): Promise<FinanceAccount[]> {
    return this.accountsFor(userId).filter((account) => options?.includeArchived || account.status === 'ativa').map((account) => ({ ...account }));
  }

  async findAccountById(userId: string, id: string): Promise<FinanceAccount | undefined> {
    return this.accountsFor(userId).find((account) => account.id === id);
  }

  async findAccountByName(userId: string, name: string): Promise<FinanceAccount | undefined> {
    const normalized = name.trim().toLowerCase();
    return this.accountsFor(userId).find((account) => account.name.trim().toLowerCase() === normalized);
  }

  async updateAccount(userId: string, input: UpdateFinanceAccountInput): Promise<FinanceAccount | undefined> {
    const account = this.accountsFor(userId).find((candidate) => candidate.id === input.id);
    if (!account) return undefined;
    const before = { ...account };
    if (input.name !== undefined) account.name = input.name;
    if (input.currency !== undefined) account.currency = input.currency;
    account.updatedAt = new Date().toISOString();
    this.audit(userId, { operation: 'account.updated', source: input.source, entityType: 'account', entityId: account.id, before, after: { ...account } });
    return { ...account };
  }

  async setAccountStatus(userId: string, input: SetFinanceAccountStatusInput): Promise<FinanceAccount | undefined> {
    const account = this.accountsFor(userId).find((candidate) => candidate.id === input.id);
    if (!account) return undefined;
    const before = { ...account };
    account.status = input.status;
    account.archivedAt = input.status === 'arquivada' ? new Date().toISOString() : undefined;
    account.updatedAt = new Date().toISOString();
    this.audit(userId, {
      operation: input.status === 'arquivada' ? 'account.archived' : 'account.restored',
      source: input.source,
      entityType: 'account',
      entityId: account.id,
      before,
      after: { ...account },
    });
    return { ...account };
  }

  async hasAccountMovements(userId: string, accountId: string): Promise<boolean> {
    return this.entriesFor(userId).some((entry) => entry.accountId === accountId);
  }

  async getAccountBalance(userId: string, accountId: string): Promise<number> {
    return this.entriesFor(userId)
      .filter((entry) => entry.accountId === accountId)
      .reduce((sum, entry) => sum + signedAmount(entry), 0);
  }

  async listAccountBalances(userId: string): Promise<FinanceAccountBalance[]> {
    const accounts = this.accountsFor(userId).filter((account) => account.status === 'ativa');
    const entries = this.entriesFor(userId);
    return accounts.map((account) => ({
      accountId: account.id,
      accountName: account.name,
      balance: entries.filter((entry) => entry.accountId === account.id).reduce((sum, entry) => sum + signedAmount(entry), 0),
    }));
  }

  // --- Categorias -----------------------------------------------------------

  async createCategory(userId: string, input: CreateFinanceCategoryInput): Promise<FinanceCategory> {
    const category: FinanceCategory = {
      id: `category_${nextCategoryId++}`,
      name: input.name,
      kind: input.kind,
      icon: input.icon,
      color: input.color,
      status: 'ativa',
      sortOrder: input.sortOrder ?? 0,
      isFavorite: input.isFavorite ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.categoriesFor(userId).push(category);
    return category;
  }

  async listCategories(userId: string, options?: { includeArchived?: boolean }): Promise<FinanceCategory[]> {
    return this.categoriesFor(userId)
      .filter((category) => options?.includeArchived || category.status === 'ativa')
      .sort((left, right) => Number(right.isFavorite) - Number(left.isFavorite) || left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'pt-BR'))
      .map((category) => ({ ...category }));
  }

  async findCategoryById(userId: string, id: string): Promise<FinanceCategory | undefined> {
    return this.categoriesFor(userId).find((category) => category.id === id);
  }
  async findCategoryByName(userId: string, name: string): Promise<FinanceCategory | undefined> {
    return this.categoriesFor(userId).find((category) => category.name.toLowerCase() === name.toLowerCase());
  }
  async updateCategory(userId: string, input: UpdateFinanceCategoryInput): Promise<FinanceCategory | undefined> {
    const category = this.categoriesFor(userId).find((candidate) => candidate.id === input.id);
    if (!category) return undefined;
    const before = { ...category };
    if (input.name !== undefined) category.name = input.name;
    if (input.icon !== undefined) category.icon = input.icon;
    if (input.color !== undefined) category.color = input.color;
    if (input.sortOrder !== undefined) category.sortOrder = input.sortOrder;
    if (input.isFavorite !== undefined) category.isFavorite = input.isFavorite;
    category.updatedAt = new Date().toISOString();
    this.audit(userId, { operation: 'category.updated', source: input.source, entityType: 'category', entityId: category.id, before, after: { ...category } });
    return { ...category };
  }
  async setCategoryStatus(userId: string, input: SetFinanceCategoryStatusInput): Promise<FinanceCategory | undefined> {
    const category = this.categoriesFor(userId).find((candidate) => candidate.id === input.id);
    if (!category) return undefined;
    const before = { ...category };
    category.status = input.status;
    category.archivedAt = input.status === 'arquivada' ? new Date().toISOString() : undefined;
    category.updatedAt = new Date().toISOString();
    this.audit(userId, { operation: input.status === 'arquivada' ? 'category.archived' : 'category.restored', source: input.source, entityType: 'category', entityId: category.id, before, after: { ...category } });
    return { ...category };
  }
  async hasCategoryTransactions(userId: string, categoryId: string): Promise<boolean> {
    return this.entriesFor(userId).some((entry) => entry.categoryId === categoryId);
  }

  async createFixedAccount(userId: string, input: CreateFixedAccountRepositoryInput): Promise<FixedAccount> {
    const now = new Date().toISOString(); const row: FixedAccount = { id: `fixed_${nextFixedAccountId++}`, ...input, description: input.description, sourceAccountId: input.sourceAccountId, destinationAccountId: input.destinationAccountId, customIntervalDays: input.customIntervalDays, endDate: input.endDate, active: true, createdAt: now, updatedAt: now };
    this.fixedAccountsFor(userId).push(row); this.audit(userId, { operation: 'fixed_account.created', source: input.source, entityType: 'fixed_account', entityId: row.id, after: row }); return { ...row };
  }
  async listFixedAccounts(userId: string, options?: { includeArchived?: boolean }): Promise<FixedAccount[]> { return this.fixedAccountsFor(userId).filter((row) => options?.includeArchived || !row.archivedAt).map((row) => ({ ...row })); }
  async findFixedAccountById(userId: string, id: string): Promise<FixedAccount | undefined> { const row = this.fixedAccountsFor(userId).find((candidate) => candidate.id === id); return row ? { ...row } : undefined; }
  async updateFixedAccount(userId: string, input: UpdateFixedAccountRepositoryInput): Promise<FixedAccount | undefined> { const row = this.fixedAccountsFor(userId).find((candidate) => candidate.id === input.id); if (!row) return undefined; const before = { ...row }; Object.assign(row, { ...input, id: row.id, source: undefined, updatedAt: new Date().toISOString() }); this.audit(userId, { operation: 'fixed_account.updated', source: input.source, entityType: 'fixed_account', entityId: row.id, before, after: { ...row } }); return { ...row }; }
  async setFixedAccountArchived(userId: string, id: string, archived: boolean, source: FinanceAuditSource): Promise<FixedAccount | undefined> { const row = this.fixedAccountsFor(userId).find((candidate) => candidate.id === id); if (!row) return undefined; const before = { ...row }; row.active = !archived; row.archivedAt = archived ? new Date().toISOString() : undefined; row.updatedAt = new Date().toISOString(); this.audit(userId, { operation: archived ? 'fixed_account.archived' : 'fixed_account.restored', source, entityType: 'fixed_account', entityId: id, before, after: { ...row } }); return { ...row }; }
  async createFixedAccountOccurrences(userId: string, rows: CreateFixedAccountOccurrenceInput[], source: FinanceAuditSource): Promise<FixedAccountOccurrence[]> { const target = this.occurrencesFor(userId); const created: FixedAccountOccurrence[] = []; for (const input of rows) { if (target.some((item) => item.fixedAccountId === input.fixedAccountId && item.referencePeriod === input.referencePeriod)) continue; const now = new Date().toISOString(); const row: FixedAccountOccurrence = { id: `occ_${nextOccurrenceId++}`, ...input, status: 'pendente', displayStatus: new Date(input.dueDate) < new Date() ? 'atrasada' : 'pendente', paidAmount: 0, createdAt: now, updatedAt: now }; target.push(row); created.push({ ...row }); const fixedAccount = this.fixedAccountsFor(userId).find((item) => item.id === input.fixedAccountId); if (fixedAccount && (!fixedAccount.lastGeneratedCompetence || fixedAccount.lastGeneratedCompetence < input.referencePeriod)) fixedAccount.lastGeneratedCompetence = input.referencePeriod; this.audit(userId, { operation: 'OCCURRENCE_GENERATED', source, entityType: 'fixed_account_occurrence', entityId: row.id, after: row }); } return created; }
  async listFixedAccountOccurrences(userId: string, filter?: FixedAccountOccurrenceFilter): Promise<FixedAccountOccurrence[]> { return this.occurrencesFor(userId).filter((row) => (!filter?.fixedAccountId || row.fixedAccountId === filter.fixedAccountId) && (!filter?.competence || `${row.competenceYear}-${String(row.competenceMonth).padStart(2, '0')}` === filter.competence) && (!filter?.status || row.displayStatus === filter.status || row.status === filter.status)).map((row) => ({ ...row, displayStatus: row.status === 'pendente' && new Date(row.dueDate) < new Date() ? 'atrasada' : row.status })); }
  async findFixedAccountOccurrenceById(userId: string, id: string): Promise<FixedAccountOccurrence | undefined> { const row = this.occurrencesFor(userId).find((candidate) => candidate.id === id); return row ? { ...row } : undefined; }
  async recordFixedAccountOccurrencePayment(userId: string, input: FixedAccountOccurrenceSettlementInput): Promise<{ occurrence: FixedAccountOccurrence; transaction: FinanceEntry } | undefined> { const occurrence = this.occurrencesFor(userId).find((item) => item.id === input.occurrenceId); if (!occurrence || occurrence.status === 'cancelada' || occurrence.status === 'paga') return undefined; if (input.amount <= 0 || input.amount > occurrence.amount - occurrence.paidAmount) throw new Error('Valor de pagamento inválido para esta ocorrência.'); const transaction = await this.createWithAudit(userId, input.transaction, { operation: 'transaction.created_from_fixed_occurrence', source: input.source }); occurrence.paidAmount += input.amount; occurrence.status = occurrence.paidAmount >= occurrence.amount ? 'paga' : 'parcial'; occurrence.displayStatus = occurrence.status; occurrence.transactionId = transaction.id; occurrence.paidAt = occurrence.status === 'paga' ? new Date().toISOString() : undefined; occurrence.updatedAt = new Date().toISOString(); this.audit(userId, { operation: occurrence.status === 'paga' ? 'OCCURRENCE_PAID' : 'OCCURRENCE_PARTIAL_PAID', source: input.source, entityType: 'fixed_account_occurrence', entityId: occurrence.id, after: occurrence }); return { occurrence: { ...occurrence }, transaction }; }
  async cancelFixedAccountOccurrence(userId: string, id: string, source: FinanceAuditSource): Promise<FixedAccountOccurrence | undefined> { const row = this.occurrencesFor(userId).find((candidate) => candidate.id === id); if (!row || row.status !== 'pendente') return undefined; row.status = 'cancelada'; row.displayStatus = 'cancelada'; row.updatedAt = new Date().toISOString(); this.audit(userId, { operation: 'OCCURRENCE_CANCELLED', source, entityType: 'fixed_account_occurrence', entityId: id, after: row }); return { ...row }; }
}
