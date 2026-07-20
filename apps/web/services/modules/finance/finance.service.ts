import type { FinanceEntry } from '@control-os/types';
import type { ActionResult } from '@/services/action-result.types';
import type { FinanceRepository } from '@/services/repositories';
import type { FinanceService } from './finance.interfaces';
import type {
  CreateExpenseInput,
  CreateIncomeInput,
  DeleteExpenseInput,
  DeleteIncomeInput,
  FinanceSummary,
  UpdateExpenseInput,
  UpdateIncomeInput,
} from './finance.types';

/**
 * CONTROL OS — Fase 6: Persistência real. Todo `Prisma*Repository` guarda
 * dados por `userId` (multi-tenant, ver `schema.prisma`), mas nada no
 * pipeline atual (`HubMessage` → `ActionRequest` → `ActionHandler.execute`)
 * carrega um `userId` de verdade ainda — essa é uma mudança de escopo
 * maior (autenticação/sessão), explicitamente fora do pedido desta fase
 * ("quero apenas persistência"). Uma única conta fixa resolve isso sem
 * mexer em nenhuma camada de cima: quando autenticação real chegar, só
 * este arquivo muda (o `userId` passa a vir de onde a sessão do usuário
 * estiver disponível) — o schema já está pronto pra receber isso hoje, não
 * precisa de nenhuma migration nova.
 */
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

/** Primeiro e último instante de um mês (fuso local) — usado por `getMonthlyExpenses`/`getMonthlyIncome`/`getSummary(reference)`. */
function monthRange(reference: Date): { from: string; to: string } {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const from = new Date(year, month, 1, 0, 0, 0, 0);
  const to = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * `PersistentFinanceService` — CONTROL OS Fase 6. Substitui completamente
 * o antigo `MockFinanceService` (array em memória) — depende só de
 * `FinanceRepository` (nunca de `PrismaFinanceRepository`/`@prisma/client`
 * diretamente, "o Module Service nunca deverá conversar diretamente com
 * Prisma"). Só `import type` de `FinanceRepository` aqui — de propósito:
 * nenhum valor concreto (nem o default de produção) é importado neste
 * arquivo, só o tipo (apagado em tempo de execução). Isso mantém esta
 * classe 100% livre de qualquer efeito colateral de módulo (nada de
 * `@prisma/client` sendo resolvido só por importar `PersistentFinanceService`
 * pra teste) — quem decide QUAL `FinanceRepository` concreto usar é o
 * ponto de composição (`services/modules/index.ts`, onde mora o singleton
 * `financeService = new PersistentFinanceService(financeRepository)`),
 * nunca a própria classe. Testes (`__tests__/finance.service.test.ts`)
 * importam esta classe direto e passam `InMemoryFinanceRepository`
 * explicitamente — sem tocar no barrel `@/services/repositories` (que é
 * quem, de fato, instancia `PrismaFinanceRepository`).
 *
 * `create*`/`update*`/`delete*` continuam devolvendo `ActionResult` —
 * formato que as Actions (`services/action-engine/actions/finance/`) já
 * esperam, inalterado desde a Fase 4. As consultas (`getBalance`/
 * `getMonthly*`/`getSummary`) são novas nesta fase e devolvem dado de
 * domínio puro — nenhuma Action as chama ainda (não fazem parte do
 * catálogo de `ActionKind`; são leitura, não comando), mas já existem para
 * quando um consumidor de Dashboard/Relatórios chegar (fora de escopo
 * desta fase).
 */
export class PersistentFinanceService implements FinanceService {
  constructor(
    private readonly repository: FinanceRepository,
    private readonly userId: string = DEFAULT_USER_ID
  ) {}

  // --- Despesas -----------------------------------------------------------

  async createExpense(input: CreateExpenseInput): Promise<ActionResult> {
    const entry = await this.repository.create(this.userId, {
      type: 'despesa',
      amount: input.amount,
      description: input.description,
      category: input.category,
      date: input.date,
    });
    return { success: true, message: `Despesa de R$ ${entry.amount.toFixed(2)} registrada em "${entry.category}".`, data: entry };
  }

  async updateExpense(input: UpdateExpenseInput): Promise<ActionResult> {
    const existing = await this.requireEntryOfType(input.id, 'despesa', 'despesa');
    if (!existing.success) return existing;

    const entry = await this.repository.update(this.userId, input);
    if (!entry) {
      return { success: false, message: `Nenhuma despesa encontrada com o id "${input.id}".` };
    }
    return { success: true, message: `Despesa "${entry.description}" atualizada.`, data: entry };
  }

  async deleteExpense(input: DeleteExpenseInput): Promise<ActionResult> {
    const existing = await this.requireEntryOfType(input.id, 'despesa', 'despesa');
    if (!existing.success) return existing;

    const entry = await this.repository.delete(this.userId, input.id);
    if (!entry) {
      return { success: false, message: `Nenhuma despesa encontrada com o id "${input.id}".` };
    }
    return { success: true, message: `Despesa "${entry.description}" removida.`, data: entry };
  }

  async listExpenses(): Promise<FinanceEntry[]> {
    return this.repository.list(this.userId, { type: 'despesa' });
  }

  // --- Receitas -------------------------------------------------------------

  async createIncome(input: CreateIncomeInput): Promise<ActionResult> {
    const entry = await this.repository.create(this.userId, {
      type: 'receita',
      amount: input.amount,
      description: input.description,
      category: input.category,
      date: input.date,
    });
    return { success: true, message: `Receita de R$ ${entry.amount.toFixed(2)} registrada em "${entry.category}".`, data: entry };
  }

  async updateIncome(input: UpdateIncomeInput): Promise<ActionResult> {
    const existing = await this.requireEntryOfType(input.id, 'receita', 'receita');
    if (!existing.success) return existing;

    const entry = await this.repository.update(this.userId, input);
    if (!entry) {
      return { success: false, message: `Nenhuma receita encontrada com o id "${input.id}".` };
    }
    return { success: true, message: `Receita "${entry.description}" atualizada.`, data: entry };
  }

  async deleteIncome(input: DeleteIncomeInput): Promise<ActionResult> {
    const existing = await this.requireEntryOfType(input.id, 'receita', 'receita');
    if (!existing.success) return existing;

    const entry = await this.repository.delete(this.userId, input.id);
    if (!entry) {
      return { success: false, message: `Nenhuma receita encontrada com o id "${input.id}".` };
    }
    return { success: true, message: `Receita "${entry.description}" removida.`, data: entry };
  }

  async listIncome(): Promise<FinanceEntry[]> {
    return this.repository.list(this.userId, { type: 'receita' });
  }

  // --- Consultas ------------------------------------------------------------

  async getBalance(): Promise<number> {
    const summary = await this.repository.getSummary(this.userId);
    return summary.balance;
  }

  async getMonthlyExpenses(reference: Date = new Date()): Promise<FinanceEntry[]> {
    const { from, to } = monthRange(reference);
    return this.repository.list(this.userId, { type: 'despesa', from, to });
  }

  async getMonthlyIncome(reference: Date = new Date()): Promise<FinanceEntry[]> {
    const { from, to } = monthRange(reference);
    return this.repository.list(this.userId, { type: 'receita', from, to });
  }

  async getSummary(reference?: Date): Promise<FinanceSummary> {
    if (!reference) {
      return this.repository.getSummary(this.userId);
    }
    const { from, to } = monthRange(reference);
    return this.repository.getSummary(this.userId, { from, to });
  }

  /**
   * Guarda contra `updateExpense`/`deleteExpense` mutarem uma receita (ou
   * o contrário) só porque `FinanceRepository.update`/`delete` são
   * genéricos sobre `type` (ver doc daquela interface). Confere o `type`
   * ANTES de qualquer mutação — devolve `{success: true}` (sentinela, sem
   * `data`) quando pode prosseguir, ou o `ActionResult` de erro já pronto
   * pra devolver direto quando não pode.
   */
  private async requireEntryOfType(
    id: string,
    expectedType: 'despesa' | 'receita',
    label: 'despesa' | 'receita'
  ): Promise<ActionResult> {
    const entry = await this.repository.findById(this.userId, id);
    if (!entry || entry.type !== expectedType) {
      return { success: false, message: `Nenhuma ${label} encontrada com o id "${id}".` };
    }
    return { success: true, message: '' };
  }
}

// Nenhum singleton exportado aqui de propósito — ver `services/modules/index.ts`
// (ponto de composição) para o `export const financeService = new
// PersistentFinanceService(financeRepository)` de produção.
