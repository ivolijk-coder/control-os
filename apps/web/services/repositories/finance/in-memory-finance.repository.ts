import type { FinanceAccount, FinanceCategory, FinanceEntry } from '@control-os/types';
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

function matchesFilter(entry: FinanceEntry, filter: FinanceTransactionFilter | undefined): boolean {
  if (!filter) return true;
  if (filter.type && entry.type !== filter.type) return false;
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
  if (entry.type === 'receita') return entry.amount;
  if (entry.type === 'despesa') return -entry.amount;
  return entry.transferDirection === 'entrada' ? entry.amount : -entry.amount;
}

export class InMemoryFinanceRepository implements FinanceRepository {
  private readonly entriesByUser = new Map<string, FinanceEntry[]>();
  private readonly accountsByUser = new Map<string, FinanceAccount[]>();
  private readonly categoriesByUser = new Map<string, FinanceCategory[]>();
  private readonly auditEventsByUser = new Map<string, Array<Record<string, unknown>>>();

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

  async update(userId: string, input: UpdateFinanceTransactionInput): Promise<FinanceEntry | undefined> {
    const entry = this.entriesFor(userId).find((candidate) => candidate.id === input.id);
    if (!entry) return undefined;
    if (input.amount !== undefined) entry.amount = input.amount;
    if (input.description !== undefined) entry.description = input.description;
    if (input.category !== undefined) entry.category = input.category;
    if (input.categoryId !== undefined) entry.categoryId = input.categoryId;
    if (input.date !== undefined) entry.date = input.date;
    if (input.accountId !== undefined) entry.accountId = input.accountId;
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
    const totalIncome = entries.filter((entry) => entry.type === 'receita').reduce((sum, entry) => sum + entry.amount, 0);
    const totalExpenses = entries.filter((entry) => entry.type === 'despesa').reduce((sum, entry) => sum + entry.amount, 0);
    return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses };
  }

  async getCategoryBreakdown(
    userId: string,
    type: 'despesa' | 'receita',
    filter?: FinanceTransactionFilter
  ): Promise<FinanceCategoryBreakdownItem[]> {
    const entries = (await this.list(userId, filter)).filter((entry) => entry.type === type);
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
}
