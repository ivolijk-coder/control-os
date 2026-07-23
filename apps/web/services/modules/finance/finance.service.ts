import { randomUUID } from 'node:crypto';
import type { FinanceAccount, FinanceCategory, FinanceEntry } from '@control-os/types';
import type { ActionResult } from '@/services/action-result.types';
import type { CreateFinanceTransactionInput, FinanceRepository } from '@/services/repositories';
import type { FinanceService } from './finance.interfaces';
import { currentFinanceUserId } from './finance-user-context';
import type {
  CreateExpenseInput,
  CreateFinanceAccountServiceInput,
  CreateFinanceCategoryServiceInput,
  CreateIncomeInput,
  CreateInstallmentInput,
  CreateRecurringInput,
  CreateTransferInput,
  DeleteExpenseInput,
  DeleteIncomeInput,
  FinanceCashFlowPoint,
  FinanceCategoryBreakdownItem,
  FinanceDashboard,
  FinanceSummary,
  UpdateExpenseInput,
  UpdateIncomeInput,
} from './finance.types';

/**
 * CONTROL OS — Fase 6: Todo `Prisma*Repository` guarda dados por `userId`
 * (multi-tenant, ver `schema.prisma`), mas nada no pipeline atual carrega
 * um `userId` de verdade ainda — mudança de escopo maior (autenticação),
 * fora do pedido desta fase. Uma única conta fixa resolve isso sem mexer
 * em nenhuma camada de cima.
 */
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

/** "Cada transação deverá pertencer a uma conta" (Fase 7) — quando nenhuma é mencionada (nem por nome, nem por id), toda transação cai aqui. */
const DEFAULT_ACCOUNT_NAME = 'Carteira';

/**
 * Catálogo de categorias PADRÃO do sistema (CONTROL OS — Fase 7, lista
 * literal do pedido original). NÃO são linhas de `finance_categories` —
 * `listCategories()` as devolve como entradas sintéticas (`isDefault:
 * true`, id `default:<nome>`) somadas às categorias personalizadas
 * (persistidas, `FinanceRepository.listCategories`). Evita ter que
 * semear/migrar dados só para um catálogo que nunca muda por usuário.
 */
const DEFAULT_FINANCE_CATEGORIES: readonly string[] = [
  'Alimentação',
  'Mercado',
  'Combustível',
  'Saúde',
  'Educação',
  'Trabalho',
  'Moradia',
  'Internet',
  'Energia',
  'Água',
  'Investimentos',
  'Salário',
  'Freelance',
];

/** Sentinela de data pras categorias padrão (sintéticas, nunca persistidas — não têm um `createdAt` real). */
const EPOCH_ISO = new Date(0).toISOString();

/** Primeiro e último instante de um mês (fuso local) — usado por `getMonthlyExpenses`/`getMonthlyIncome`/`getSummary(reference)`/`getExpensesByCategory`/`getIncomeByCategory`/`getCashFlow`. */
function monthRange(reference: Date): { from: string; to: string } {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const from = new Date(year, month, 1, 0, 0, 0, 0);
  const to = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * Divide `totalAmount` em `installments` parcelas iguais, em centavos, sem
 * deriva de ponto flutuante — a última parcela absorve o resto da divisão
 * (ex.: R$ 100,00 em 3x vira 33,33 + 33,33 + 33,34, nunca 33,333... × 3).
 * Cada parcela nasce 1 mês depois da anterior a partir de `startDate`
 * (convenção comum de parcelamento de cartão no Brasil).
 */
function buildInstallmentLegs(params: {
  type: 'receita' | 'despesa';
  totalAmount: number;
  installments: number;
  description?: string;
  category?: string;
  accountId: string;
  startDate?: string;
}): CreateFinanceTransactionInput[] {
  const { type, totalAmount, installments, description, category, accountId, startDate } = params;
  const installmentGroupId = randomUUID();
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / installments);
  const remainderCents = totalCents - baseCents * installments;
  const start = startDate ? new Date(startDate) : new Date();
  const baseDescription = description ?? (type === 'despesa' ? 'Despesa parcelada' : 'Receita parcelada');

  return Array.from({ length: installments }, (_unused, index) => {
    const isLast = index === installments - 1;
    const cents = baseCents + (isLast ? remainderCents : 0);
    const date = new Date(start.getFullYear(), start.getMonth() + index, start.getDate());
    return {
      type,
      amount: cents / 100,
      description: `${baseDescription} (${index + 1}/${installments})`,
      category,
      date: date.toISOString(),
      accountId,
      installmentGroupId,
      installmentNumber: index + 1,
      installmentTotal: installments,
    };
  });
}

/**
 * `PersistentFinanceService` — CONTROL OS Fase 6 (substitui o antigo
 * `MockFinanceService`); Fase 7 adiciona Transferências, Parcelamentos,
 * Recorrências, Contas, Categorias e Dashboard. Depende só de
 * `FinanceRepository` (nunca de `PrismaFinanceRepository`/`@prisma/client`
 * diretamente, "o Module Service nunca deverá conversar diretamente com
 * Prisma"). Só `import type` de `FinanceRepository` aqui — nenhum valor
 * concreto (nem o default de produção) é importado neste arquivo, só o
 * tipo (apagado em tempo de execução). Isso mantém esta classe 100% livre
 * de qualquer efeito colateral de módulo — quem decide QUAL
 * `FinanceRepository` concreto usar é o ponto de composição
 * (`services/modules/index.ts`).
 */
export class PersistentFinanceService implements FinanceService {
  constructor(
    private readonly repository: FinanceRepository,
    private readonly fallbackUserId: string = DEFAULT_USER_ID
  ) {}

  private get userId(): string {
    return currentFinanceUserId() ?? this.fallbackUserId;
  }

  // --- Resolução de conta (CONTROL OS — Fase 7) ------------------------------

  /**
   * "Cada transação deverá pertencer a uma conta" — mas quem chama (Action,
   * chat) quase sempre só tem um NOME em texto, não um id. Get-or-create
   * por nome (case-insensitive); sem nome nenhum, usa a conta padrão
   * ("Carteira") — também get-or-create, então a PRIMEIRA despesa de um
   * usuário novo já cria a Carteira automaticamente, sem passo manual.
   */
  private async resolveAccountId(accountId?: string, accountName?: string): Promise<string> {
    if (accountId) return accountId;
    const name = accountName?.trim() || DEFAULT_ACCOUNT_NAME;
    const existing = await this.repository.findAccountByName(this.userId, name);
    if (existing) return existing.id;
    const created = await this.repository.createAccount(this.userId, { name });
    return created.id;
  }

  // --- Despesas -----------------------------------------------------------

  async createExpense(input: CreateExpenseInput): Promise<ActionResult> {
    const accountId = await this.resolveAccountId(input.accountId, input.accountName);
    const entry = await this.repository.create(this.userId, {
      type: 'despesa',
      amount: input.amount,
      description: input.description,
      category: input.category,
      date: input.date,
      accountId,
    });
    return { success: true, message: `Despesa de R$ ${entry.amount.toFixed(2)} registrada em "${entry.category}".`, data: entry };
  }

  async updateExpense(input: UpdateExpenseInput): Promise<ActionResult> {
    const existing = await this.requireEntryOfType(input.id, 'despesa', 'despesa');
    if (!existing.success) return existing;

    const accountId = input.accountId ?? (input.accountName ? await this.resolveAccountId(undefined, input.accountName) : undefined);
    const entry = await this.repository.update(this.userId, { ...input, accountId });
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
    const accountId = await this.resolveAccountId(input.accountId, input.accountName);
    const entry = await this.repository.create(this.userId, {
      type: 'receita',
      amount: input.amount,
      description: input.description,
      category: input.category,
      date: input.date,
      accountId,
    });
    return { success: true, message: `Receita de R$ ${entry.amount.toFixed(2)} registrada em "${entry.category}".`, data: entry };
  }

  async updateIncome(input: UpdateIncomeInput): Promise<ActionResult> {
    const existing = await this.requireEntryOfType(input.id, 'receita', 'receita');
    if (!existing.success) return existing;

    const accountId = input.accountId ?? (input.accountName ? await this.resolveAccountId(undefined, input.accountName) : undefined);
    const entry = await this.repository.update(this.userId, { ...input, accountId });
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

  // --- Transferências (CONTROL OS — Fase 7) -----------------------------------

  /**
   * "Transferência entre contas... sem alterar patrimônio total" — cria
   * DUAS transações (`type: 'transferencia'`) atomicamente
   * (`repository.createMany`), ligadas por `transferGroupId`: uma
   * `'saida'` na conta de origem, uma `'entrada'` na conta de destino.
   * `getSummary`/`getBalance` ignoram `'transferencia'` de propósito (só
   * somam receita/despesa) — o patrimônio TOTAL nunca muda; só o saldo POR
   * CONTA muda (`getAccountBalance`, que soma as duas pernas com sinal).
   */
  async createTransfer(input: CreateTransferInput): Promise<ActionResult> {
    if (!(input.amount > 0)) {
      return { success: false, message: 'O valor da transferência precisa ser maior que zero.' };
    }
    const toAccountName = input.toAccountName.trim();
    if (!toAccountName) {
      return { success: false, message: 'Preciso saber para qual conta transferir.' };
    }

    const fromAccountId = await this.resolveAccountId(undefined, input.fromAccountName);
    const toAccountId = await this.resolveAccountId(undefined, toAccountName);
    if (fromAccountId === toAccountId) {
      return { success: false, message: 'A conta de origem e a de destino não podem ser a mesma.' };
    }

    const transferGroupId = randomUUID();
    const description = input.description ?? `Transferência para ${toAccountName}`;
    const [outEntry, inEntry] = await this.repository.createMany(this.userId, [
      {
        type: 'transferencia',
        amount: input.amount,
        description,
        date: input.date,
        accountId: fromAccountId,
        transferGroupId,
        transferDirection: 'saida',
      },
      {
        type: 'transferencia',
        amount: input.amount,
        description,
        date: input.date,
        accountId: toAccountId,
        transferGroupId,
        transferDirection: 'entrada',
      },
    ]);

    return {
      success: true,
      message: `Transferência de R$ ${input.amount.toFixed(2)} para "${toAccountName}" concluída.`,
      data: { out: outEntry, in: inEntry },
    };
  }

  // --- Parcelamentos (CONTROL OS — Fase 7) ------------------------------------

  /** "Parcela esse notebook em 12x" → 12 lançamentos relacionados (`installmentGroupId`), atomicamente. */
  async createInstallment(input: CreateInstallmentInput): Promise<ActionResult> {
    const type = input.type ?? 'despesa';
    if (!(input.installments >= 2)) {
      return { success: false, message: 'Um parcelamento precisa de pelo menos 2 parcelas.' };
    }
    if (!(input.totalAmount > 0)) {
      return { success: false, message: 'O valor total do parcelamento precisa ser maior que zero.' };
    }

    const accountId = await this.resolveAccountId(input.accountId, input.accountName);
    const legs = buildInstallmentLegs({
      type,
      totalAmount: input.totalAmount,
      installments: input.installments,
      description: input.description,
      category: input.category,
      accountId,
      startDate: input.startDate,
    });
    const entries = await this.repository.createMany(this.userId, legs);
    const perInstallment = entries[0]?.amount ?? input.totalAmount / input.installments;

    return {
      success: true,
      message: `Parcelamento de R$ ${input.totalAmount.toFixed(2)} em ${input.installments}x de R$ ${perInstallment.toFixed(2)} criado.`,
      data: entries,
    };
  }

  // --- Recorrências (CONTROL OS — Fase 7) -------------------------------------

  /** "Mensal, Semanal, Anual... ainda não criar scheduler" — cria só a primeira ocorrência, com `recurrenceFrequency` marcado (preparado para geração automática futura). */
  async createRecurring(input: CreateRecurringInput): Promise<ActionResult> {
    const type = input.type ?? 'despesa';
    if (!(input.amount > 0)) {
      return { success: false, message: 'O valor da recorrência precisa ser maior que zero.' };
    }

    const accountId = await this.resolveAccountId(input.accountId, input.accountName);
    const entry = await this.repository.create(this.userId, {
      type,
      amount: input.amount,
      description: input.description,
      category: input.category,
      date: input.date,
      accountId,
      recurrenceFrequency: input.frequency,
    });

    return {
      success: true,
      message: `Recorrência ${input.frequency} de R$ ${input.amount.toFixed(2)} criada (a geração automática das próximas ocorrências ainda não existe).`,
      data: entry,
    };
  }

  // --- Contas (CONTROL OS — Fase 7) -------------------------------------------

  async createAccount(input: CreateFinanceAccountServiceInput): Promise<ActionResult> {
    const name = input.name.trim();
    if (!name) {
      return { success: false, message: 'Preciso de um nome para criar a conta.' };
    }
    const existing = await this.repository.findAccountByName(this.userId, name);
    if (existing) {
      return { success: false, message: `Já existe uma conta chamada "${existing.name}".` };
    }
    const account = await this.repository.createAccount(this.userId, { name, kind: input.kind });
    return { success: true, message: `Conta "${account.name}" criada.`, data: account };
  }

  async listAccounts(): Promise<FinanceAccount[]> {
    return this.repository.listAccounts(this.userId);
  }

  // --- Categorias -------------------------------------------------------------

  async createCategory(input: CreateFinanceCategoryServiceInput): Promise<ActionResult> {
    const name = input.name.trim();
    if (!name) {
      return { success: false, message: 'Preciso de um nome para criar a categoria.' };
    }
    const clashesWithDefault = DEFAULT_FINANCE_CATEGORIES.some((candidate) => candidate.toLowerCase() === name.toLowerCase());
    if (clashesWithDefault) {
      return { success: false, message: `"${name}" já é uma categoria padrão do sistema.` };
    }
    const existingCustom = (await this.repository.listCategories(this.userId)).find(
      (candidate) => candidate.name.toLowerCase() === name.toLowerCase()
    );
    if (existingCustom) {
      return { success: false, message: `Já existe uma categoria personalizada chamada "${existingCustom.name}".` };
    }
    const category = await this.repository.createCategory(this.userId, { name, kind: input.kind });
    return { success: true, message: `Categoria "${category.name}" criada.`, data: category };
  }

  async listCategories(): Promise<FinanceCategory[]> {
    const defaults: FinanceCategory[] = DEFAULT_FINANCE_CATEGORIES.map((name) => ({
      id: `default:${name}`,
      name,
      isDefault: true,
      createdAt: EPOCH_ISO,
    }));
    const custom = await this.repository.listCategories(this.userId);
    return [...defaults, ...custom];
  }

  // --- Consultas ------------------------------------------------------------

  async getBalance(): Promise<number> {
    const summary = await this.repository.getSummary(this.userId);
    return summary.balance;
  }

  async getAccountBalance(accountId: string): Promise<number> {
    return this.repository.getAccountBalance(this.userId, accountId);
  }

  async listAccountBalances() {
    return this.repository.listAccountBalances(this.userId);
  }

  async getMonthlyExpenses(reference: Date = new Date()): Promise<FinanceEntry[]> {
    const { from, to } = monthRange(reference);
    return this.repository.list(this.userId, { type: 'despesa', from, to });
  }

  async getMonthlyIncome(reference: Date = new Date()): Promise<FinanceEntry[]> {
    const { from, to } = monthRange(reference);
    return this.repository.list(this.userId, { type: 'receita', from, to });
  }

  async getExpensesByCategory(reference?: Date): Promise<FinanceCategoryBreakdownItem[]> {
    const filter = reference ? monthRange(reference) : undefined;
    return this.repository.getCategoryBreakdown(this.userId, 'despesa', filter);
  }

  async getIncomeByCategory(reference?: Date): Promise<FinanceCategoryBreakdownItem[]> {
    const filter = reference ? monthRange(reference) : undefined;
    return this.repository.getCategoryBreakdown(this.userId, 'receita', filter);
  }

  /**
   * "Fluxo de caixa" — um `getSummary` por mês (`Promise.all`, concorrente,
   * nunca sequencial) — `monthsBack` é sempre um número pequeno e
   * constante (ex.: 6), então N consultas paralelas continuam muito mais
   * baratas que uma única consulta com `date_trunc` via SQL bruto
   * (`$queryRaw`), que exigiria abrir mão do `groupBy` tipado do Prisma
   * sem necessidade real nesta fase.
   */
  async getCashFlow(monthsBack = 6): Promise<FinanceCashFlowPoint[]> {
    const now = new Date();
    const months = Array.from({ length: monthsBack }, (_unused, index) => new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1 - index), 1));
    const summaries = await Promise.all(months.map((month) => this.repository.getSummary(this.userId, monthRange(month))));

    return months.map((month, index) => {
      const summary: FinanceSummary = summaries[index] ?? { totalIncome: 0, totalExpenses: 0, balance: 0 };
      return {
        year: month.getFullYear(),
        month: month.getMonth() + 1,
        totalIncome: summary.totalIncome,
        totalExpenses: summary.totalExpenses,
        balance: summary.balance,
      };
    });
  }

  async getSummary(reference?: Date): Promise<FinanceSummary> {
    if (!reference) {
      return this.repository.getSummary(this.userId);
    }
    const { from, to } = monthRange(reference);
    return this.repository.getSummary(this.userId, { from, to });
  }

  // --- Dashboard (CONTROL OS — Fase 7) -----------------------------------------

  /**
   * "Saldo Atual, Receitas, Despesas, Economia, Categorias que mais gastam,
   * Últimas movimentações, Evolução mensal... Ainda não criar interface
   * gráfica. Apenas Services." Puramente composição de consultas que já
   * existem nesta classe — nenhuma lógica nova, "evitar duplicação".
   * `Promise.all`: as 5 consultas não dependem umas das outras, então
   * rodam concorrentemente, não em sequência.
   */
  async getDashboard(): Promise<FinanceDashboard> {
    const now = new Date();
    const [balance, monthSummary, topExpenseCategoriesRaw, recentTransactions, monthlyEvolution] = await Promise.all([
      this.getBalance(),
      this.getSummary(now),
      this.getExpensesByCategory(now),
      this.repository.getRecent(this.userId, 10),
      this.getCashFlow(6),
    ]);

    return {
      currentBalance: balance,
      monthIncome: monthSummary.totalIncome,
      monthExpenses: monthSummary.totalExpenses,
      savings: monthSummary.totalIncome - monthSummary.totalExpenses,
      topExpenseCategories: topExpenseCategoriesRaw.slice(0, 5),
      recentTransactions,
      monthlyEvolution,
    };
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
