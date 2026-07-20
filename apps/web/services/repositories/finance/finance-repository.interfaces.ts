import type { FinanceEntry } from '@control-os/types';
import type {
  CreateFinanceTransactionInput,
  FinanceSummary,
  FinanceTransactionFilter,
  UpdateFinanceTransactionInput,
} from './finance-repository.types';

/**
 * `FinanceRepository` — CONTROL OS Fase 6 (Persistência real). Contrato que
 * `FinanceService` (`services/modules/finance`) depende — nunca de
 * `PrismaFinanceRepository` diretamente. "O Module Service nunca deverá
 * conversar diretamente com Prisma."
 *
 * Genérico sobre `type` ('receita'/'despesa') em vez de dois conjuntos de
 * métodos (`createIncome`/`createExpense` no REPOSITÓRIO) — "criar uma
 * entidade única... Income, Expense" já é o `FinanceEntry`/`Transaction`
 * unificados; a distinção receita/despesa é só um campo, não dois
 * contratos. É `FinanceService`, uma camada acima, que expõe a API
 * receita/despesa separada que o pedido original pede
 * (`createIncome`/`createExpense`...), traduzindo pra este método único.
 *
 * Implementações previstas (nenhuma exige mudar `FinanceService` nem as
 * Actions): `PrismaFinanceRepository` (produção, `@prisma/client`),
 * `InMemoryFinanceRepository` (testes), e no futuro
 * `SupabaseFinanceRepository`/`SQLiteFinanceRepository`.
 */
export interface FinanceRepository {
  create(userId: string, input: CreateFinanceTransactionInput): Promise<FinanceEntry>;
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
  /**
   * Agregado no lado do Repository (não "buscar tudo e somar no
   * Service") — "Performance: evitar consultas desnecessárias." Em
   * `PrismaFinanceRepository` isto vira `groupBy`/`aggregate` no banco;
   * `InMemoryFinanceRepository` soma em memória, mesma semântica.
   */
  getSummary(userId: string, filter?: FinanceTransactionFilter): Promise<FinanceSummary>;
}
