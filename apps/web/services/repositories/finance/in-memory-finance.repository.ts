import type { FinanceEntry } from '@control-os/types';
import type { FinanceRepository } from './finance-repository.interfaces';
import type {
  CreateFinanceTransactionInput,
  FinanceSummary,
  FinanceTransactionFilter,
  UpdateFinanceTransactionInput,
} from './finance-repository.types';

/**
 * `InMemoryFinanceRepository` — CONTROL OS Fase 6. "No futuro existirão
 * naturalmente: ... InMemoryRepository, TestRepository. Sem alterar nenhum
 * Service." Esta é essa implementação — guarda `FinanceEntry` num `Map`
 * por `userId`, sem nenhuma dependência de rede/banco.
 *
 * Dois usos: (1) os testes desta fase (`__tests__/finance.test.ts`) —
 * "utilizar banco de testes ou implementação adequada para testes", e esta
 * sandbox não tem acesso a um Postgres de teste nem ao CLI do Prisma (ver
 * relatório da fase), então esta é a via real de testar toda a lógica de
 * `FinanceService` de ponta a ponta sem mock nenhum de rede; (2) sucessora
 * direta do antigo `MockFinanceService` (mesmo comportamento observável),
 * caso algum consumidor precise rodar sem banco nenhum configurado.
 *
 * Particionado por `userId` (um `Map<string, FinanceEntry[]>`, não um
 * array só) — mesmo formato multi-tenant do `PrismaFinanceRepository` de
 * verdade, mesmo que `FinanceService` hoje só use um `DEFAULT_USER_ID`
 * fixo (ver `finance.service.ts`); isso mantém os testes desta fase
 * significativos também para um futuro multi-usuário, sem reescrever esta
 * classe.
 */
let nextId = 1;

function matchesFilter(entry: FinanceEntry, filter: FinanceTransactionFilter | undefined): boolean {
  if (!filter) return true;
  if (filter.type && entry.type !== filter.type) return false;
  if (filter.from && entry.date < filter.from) return false;
  if (filter.to && entry.date > filter.to) return false;
  return true;
}

export class InMemoryFinanceRepository implements FinanceRepository {
  private readonly entriesByUser = new Map<string, FinanceEntry[]>();

  private entriesFor(userId: string): FinanceEntry[] {
    let entries = this.entriesByUser.get(userId);
    if (!entries) {
      entries = [];
      this.entriesByUser.set(userId, entries);
    }
    return entries;
  }

  async create(userId: string, input: CreateFinanceTransactionInput): Promise<FinanceEntry> {
    const entry: FinanceEntry = {
      id: `finance_${nextId++}`,
      type: input.type,
      description: input.description ?? (input.type === 'despesa' ? 'Despesa registrada' : 'Receita registrada'),
      amount: input.amount,
      category: input.category ?? 'Outros',
      date: input.date ?? new Date().toISOString(),
    };
    this.entriesFor(userId).push(entry);
    return entry;
  }

  async update(userId: string, input: UpdateFinanceTransactionInput): Promise<FinanceEntry | undefined> {
    const entry = this.entriesFor(userId).find((candidate) => candidate.id === input.id);
    if (!entry) return undefined;
    if (input.amount !== undefined) entry.amount = input.amount;
    if (input.description !== undefined) entry.description = input.description;
    if (input.category !== undefined) entry.category = input.category;
    if (input.date !== undefined) entry.date = input.date;
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

  async getSummary(userId: string, filter?: FinanceTransactionFilter): Promise<FinanceSummary> {
    const entries = await this.list(userId, filter);
    const totalIncome = entries.filter((entry) => entry.type === 'receita').reduce((sum, entry) => sum + entry.amount, 0);
    const totalExpenses = entries.filter((entry) => entry.type === 'despesa').reduce((sum, entry) => sum + entry.amount, 0);
    return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses };
  }
}
