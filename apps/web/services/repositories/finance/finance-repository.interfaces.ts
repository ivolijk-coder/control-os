import type { FinanceAccount, FinanceCategory, FinanceEntry } from '@control-os/types';
import type {
  CreateFinanceAccountInput,
  CreateFinanceCategoryInput,
  CreateFinanceTransactionInput,
  SetFinanceAccountStatusInput,
  UpdateFinanceAccountInput,
  FinanceAccountBalance,
  FinanceCategoryBreakdownItem,
  FinanceSummary,
  FinanceTransactionFilter,
  UpdateFinanceTransactionInput,
  UpdateFinanceCategoryInput,
  SetFinanceCategoryStatusInput,
  TransactionAuditCommand,
} from './finance-repository.types';

/**
 * `FinanceRepository` — CONTROL OS Fase 6 (Persistência real); Fase 7
 * (Financeiro completo) adiciona Contas, Categorias e as consultas
 * agregadas do Dashboard. Contrato que `FinanceService`
 * (`services/modules/finance`) depende — nunca de `PrismaFinanceRepository`
 * diretamente. "O Module Service nunca deverá conversar diretamente com
 * Prisma."
 *
 * Genérico sobre `type` ('receita'/'despesa'/'transferencia') em vez de um
 * método por tipo — "criar uma entidade única" (`Transaction`/`FinanceEntry`)
 * continua valendo mesmo com o terceiro tipo; a distinção é só um campo,
 * nunca um contrato à parte. Transferências e parcelamentos NÃO ganham
 * métodos próprios aqui — são só `createMany` com pernas já montadas pelo
 * `FinanceService` (regra de negócio de como montar as pernas mora no
 * Service, nunca no Repository — "o Repository só persiste").
 *
 * Implementações previstas (nenhuma exige mudar `FinanceService` nem as
 * Actions): `PrismaFinanceRepository` (produção, `@prisma/client`),
 * `InMemoryFinanceRepository` (testes), e no futuro
 * `SupabaseFinanceRepository`/`SQLiteFinanceRepository`.
 */
export interface FinanceRepository {
  // --- Transações -----------------------------------------------------------
  create(userId: string, input: CreateFinanceTransactionInput): Promise<FinanceEntry>;
  /**
   * CONTROL OS — Fase 7: cria várias transações de uma vez, atomicamente
   * (todas ou nenhuma) — usado por transferências (2 pernas) e
   * parcelamentos (N parcelas). `PrismaFinanceRepository` embrulha isto num
   * `prisma.$transaction`; `InMemoryFinanceRepository` não precisa (já é
   * atômico, single-threaded).
   */
  createMany(userId: string, inputs: CreateFinanceTransactionInput[]): Promise<FinanceEntry[]>;
  /** Primitivas atômicas usadas exclusivamente pelo núcleo de transações. */
  createWithAudit(userId: string, input: CreateFinanceTransactionInput, audit: TransactionAuditCommand): Promise<FinanceEntry>;
  createManyWithAudit(userId: string, inputs: CreateFinanceTransactionInput[], audit: TransactionAuditCommand): Promise<FinanceEntry[]>;
  updateWithAudit(userId: string, input: UpdateFinanceTransactionInput, audit: TransactionAuditCommand): Promise<FinanceEntry | undefined>;
  transitionWithAudit(userId: string, id: string, status: import('@control-os/types').FinanceTransactionStatus, audit: TransactionAuditCommand): Promise<FinanceEntry | undefined>;
  reverseWithAudit(userId: string, originals: FinanceEntry[], reversals: CreateFinanceTransactionInput[], audit: TransactionAuditCommand): Promise<FinanceEntry[] | undefined>;
  findByIdempotencyKey(userId: string, key: string): Promise<FinanceEntry | undefined>;
  update(userId: string, input: UpdateFinanceTransactionInput): Promise<FinanceEntry | undefined>;
  delete(userId: string, id: string): Promise<FinanceEntry | undefined>;
  /**
   * Usado por `FinanceService` para conferir o `type` ANTES de
   * atualizar/remover — `updateExpense`/`deleteExpense` não deveriam
   * conseguir mutar uma receita (nem o contrário) só porque
   * `update`/`delete` aqui são genéricos sobre `type` (ver doc da
   * interface). Sem isto, um `id` de receita passado pra `updateExpense`
   * seria silenciosamente aceito.
   */
  findById(userId: string, id: string): Promise<FinanceEntry | undefined>;
  list(userId: string, filter?: FinanceTransactionFilter): Promise<FinanceEntry[]>;
  /** "Últimas movimentações" (Dashboard) — mais recentes primeiro, limitadas a `limit`. */
  getRecent(userId: string, limit: number): Promise<FinanceEntry[]>;
  /**
   * Agregado no lado do Repository (não "buscar tudo e somar no
   * Service") — "Performance: evitar consultas desnecessárias." Em
   * `PrismaFinanceRepository` isto vira `groupBy`/`aggregate` no banco;
   * `InMemoryFinanceRepository` soma em memória, mesma semântica.
   */
  getSummary(userId: string, filter?: FinanceTransactionFilter): Promise<FinanceSummary>;
  /** "Categorias que mais gastam" (Dashboard) — soma por categoria, ordenado do maior para o menor. `type` filtra despesa OU receita (nunca transferência). */
  getCategoryBreakdown(
    userId: string,
    type: 'despesa' | 'receita',
    filter?: FinanceTransactionFilter
  ): Promise<FinanceCategoryBreakdownItem[]>;

  // --- Contas (CONTROL OS — Fase 7) ------------------------------------------
  /** Cria conta, lançamento técnico de abertura e auditoria em uma única transação. */
  createAccount(userId: string, input: CreateFinanceAccountInput): Promise<FinanceAccount>;
  listAccounts(userId: string, options?: { includeArchived?: boolean }): Promise<FinanceAccount[]>;
  findAccountById(userId: string, id: string): Promise<FinanceAccount | undefined>;
  /** Busca case-insensitive por nome (ex.: resolver "nubank" dito em conversa para a conta "Nubank" já existente). */
  findAccountByName(userId: string, name: string): Promise<FinanceAccount | undefined>;
  /** Atualiza uma conta e registra estado anterior/posterior na auditoria. */
  updateAccount(userId: string, input: UpdateFinanceAccountInput): Promise<FinanceAccount | undefined>;
  /** Arquiva ou restaura, preservando todo o histórico financeiro. */
  setAccountStatus(userId: string, input: SetFinanceAccountStatusInput): Promise<FinanceAccount | undefined>;
  hasAccountMovements(userId: string, accountId: string): Promise<boolean>;
  /**
   * Saldo de UMA conta — soma com sinal: `despesa` → `-amount`, `receita` →
   * `+amount`, `transferencia` com `transferDirection: 'saida'` →
   * `-amount`, `'entrada'` → `+amount`. Diferente de `getSummary` (que
   * ignora transferências de propósito): aqui elas PRECISAM entrar, porque
   * uma transferência move dinheiro de fato entre contas.
   */
  getAccountBalance(userId: string, accountId: string): Promise<number>;
  /** Saldo de TODAS as contas do usuário numa única consulta agregada (nunca N+1 — uma `groupBy` por `[accountId, type, transferDirection]`, combinado em memória). */
  listAccountBalances(userId: string): Promise<FinanceAccountBalance[]>;

  // --- Categorias (CONTROL OS — Fase 7) --------------------------------------
  /** Categorias pessoais e categorias padrão materializadas para o usuário. */
  createCategory(userId: string, input: CreateFinanceCategoryInput): Promise<FinanceCategory>;
  listCategories(userId: string, options?: { includeArchived?: boolean }): Promise<FinanceCategory[]>;
  findCategoryById(userId: string, id: string): Promise<FinanceCategory | undefined>;
  findCategoryByName(userId: string, name: string): Promise<FinanceCategory | undefined>;
  updateCategory(userId: string, input: UpdateFinanceCategoryInput): Promise<FinanceCategory | undefined>;
  setCategoryStatus(userId: string, input: SetFinanceCategoryStatusInput): Promise<FinanceCategory | undefined>;
  hasCategoryTransactions(userId: string, categoryId: string): Promise<boolean>;
}
