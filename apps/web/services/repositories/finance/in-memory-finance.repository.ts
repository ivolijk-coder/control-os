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

  // --- Transações -------------------------------------------------------

  async create(userId: string, input: CreateFinanceTransactionInput): Promise<FinanceEntry> {
    const entry: FinanceEntry = {
      id: `finance_${nextTransactionId++}`,
      type: input.type,
      description: input.description ?? (input.type === 'despesa' ? 'Despesa registrada' : 'Receita registrada'),
      amount: input.amount,
      category: input.category ?? 'Outros',
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
    const account: FinanceAccount = {
      id: `account_${nextAccountId++}`,
      name: input.name,
      kind: input.kind ?? 'outro',
      createdAt: new Date().toISOString(),
    };
    this.accountsFor(userId).push(account);
    return account;
  }

  async listAccounts(userId: string): Promise<FinanceAccount[]> {
    return [...this.accountsFor(userId)];
  }

  async findAccountById(userId: string, id: string): Promise<FinanceAccount | undefined> {
    return this.accountsFor(userId).find((account) => account.id === id);
  }

  async findAccountByName(userId: string, name: string): Promise<FinanceAccount | undefined> {
    const normalized = name.trim().toLowerCase();
    return this.accountsFor(userId).find((account) => account.name.trim().toLowerCase() === normalized);
  }

  async getAccountBalance(userId: string, accountId: string): Promise<number> {
    return this.entriesFor(userId)
      .filter((entry) => entry.accountId === accountId)
      .reduce((sum, entry) => sum + signedAmount(entry), 0);
  }

  async listAccountBalances(userId: string): Promise<FinanceAccountBalance[]> {
    const accounts = this.accountsFor(userId);
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
      createdAt: new Date().toISOString(),
    };
    this.categoriesFor(userId).push(category);
    return category;
  }

  async listCategories(userId: string): Promise<FinanceCategory[]> {
    return [...this.categoriesFor(userId)];
  }
}
