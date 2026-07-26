import type { FinanceAccountKind, FinanceEntry, FinanceEntryType, FinanceRecurrenceFrequency } from '@control-os/types';
import type { FinanceAccountBalance, FinanceCategoryBreakdownItem } from '@/services/repositories';

/**
 * Módulo Financeiro (CONTROL HUB — Fase 4: Action Engine real; Fase 6:
 * Persistência real — ganha Receitas + Consultas; Fase 7: Financeiro
 * completo — contas, categorias, transferências, parcelamentos,
 * recorrências, Dashboard). `amount`/`category`/`date` seguem o mesmo
 * formato de `FinanceEntry` (`@control-os/types`) — nenhuma forma nova
 * inventada.
 */

/**
 * `accountId`/`accountName` — CONTROL OS Fase 7: "cada transação deverá
 * pertencer a uma conta". Quem chama (Action, chat) quase sempre só tem um
 * NOME em texto ("no Nubank", nunca um UUID) — `FinanceService` resolve
 * o nome para uma conta de verdade; `accountId` existe pra
 * quando o chamador já sabe o id (ex.: uma tela que lista contas antes).
 * Quando nenhum dos dois for informado, o serviço usa a única conta ativa
 * existente; se houver zero ou mais de uma, pede que a conta seja escolhida.
 */
export interface CreateExpenseInput {
  amount: number;
  description?: string;
  category?: string;
  /** ISO (`YYYY-MM-DD` ou timestamp completo) — quando ausente, a implementação ativa usa o momento da chamada. */
  date?: string;
  accountId?: string;
  accountName?: string;
}

export interface UpdateExpenseInput {
  id: string;
  amount?: number;
  description?: string;
  category?: string;
  date?: string;
  accountId?: string;
  accountName?: string;
}

export interface DeleteExpenseInput {
  id: string;
}

/** Fase 6 — mesma forma de `CreateExpenseInput`, espelhando `income.create` (`ActionKind`). */
export interface CreateIncomeInput {
  amount: number;
  description?: string;
  category?: string;
  date?: string;
  accountId?: string;
  accountName?: string;
}

export interface UpdateIncomeInput {
  id: string;
  amount?: number;
  description?: string;
  category?: string;
  date?: string;
  accountId?: string;
  accountName?: string;
}

export interface DeleteIncomeInput {
  id: string;
}

/** Fase 6 — "Consultas: despesas do mês, receitas do mês, resumo financeiro". `reference` ausente = mês corrente. */
export interface MonthlyQueryInput {
  reference?: Date;
}

/** "Resumo financeiro" — mesma forma para saldo geral (`getSummary()`, sem `reference`) e resumo de um mês (`getSummary({reference})`). */
export interface FinanceSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

// --- CONTROL OS — Fase 7: Transferências ------------------------------------

/**
 * "Transferência entre contas... sem alterar patrimônio total" — as duas
 * contas são sempre por NOME, nunca id: a conversa
 * ("Transferi 500 para o Nubank") só tem o nome da conta de destino; a
 * origem, quando não dita, só pode ser inferida caso exista exatamente uma
 * conta ativa; de outro modo o serviço pede a escolha explícita.
 */
export interface CreateTransferInput {
  fromAccountName?: string;
  toAccountName: string;
  amount: number;
  description?: string;
  date?: string;
}

// --- CONTROL OS — Fase 7: Parcelamentos -------------------------------------

/** "Parcela esse notebook em 12x" — `type` default `'despesa'` (o caso conversacional real); `'receita'` também é aceito (ex.: pagamento recebido parcelado). */
export interface CreateInstallmentInput {
  type?: 'receita' | 'despesa';
  totalAmount: number;
  installments: number;
  description?: string;
  category?: string;
  accountId?: string;
  accountName?: string;
  /** ISO — data da primeira parcela; as demais são geradas +1 mês cada. Ausente = hoje. */
  startDate?: string;
}

// --- CONTROL OS — Fase 7: Recorrências ---------------------------------------

/** "Mensal, Semanal, Anual... preparar arquitetura para geração automática futura. Ainda não criar scheduler" — só a primeira ocorrência é criada aqui. */
export interface CreateRecurringInput {
  type?: 'receita' | 'despesa';
  amount: number;
  description?: string;
  category?: string;
  frequency: FinanceRecurrenceFrequency;
  accountId?: string;
  accountName?: string;
  date?: string;
}

// --- CONTROL OS — Fase 7: Contas ---------------------------------------------

export interface CreateFinanceAccountServiceInput {
  name: string;
  kind?: FinanceAccountKind;
  currency?: string;
  initialBalanceCents?: number;
  openingBalanceDate?: string;
  source?: 'manual' | 'nova' | 'whatsapp' | 'api';
}

export interface UpdateFinanceAccountServiceInput {
  id: string;
  name?: string;
  currency?: string;
  source?: 'manual' | 'nova' | 'whatsapp' | 'api';
}

// --- CONTROL OS — Fase 7: Categorias -----------------------------------------

export interface CreateFinanceCategoryServiceInput {
  name: string;
  kind?: FinanceEntryType;
}

// --- CONTROL OS — Fase 7: Dashboard ------------------------------------------

/** Um ponto do "Fluxo de caixa"/"Evolução mensal" — um mês, receitas x despesas x saldo do período. */
export interface FinanceCashFlowPoint {
  year: number;
  month: number;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

/**
 * "Dashboard: Saldo Atual, Receitas, Despesas, Economia, Categorias que
 * mais gastam, Últimas movimentações, Evolução mensal... Ainda não criar
 * interface gráfica. Apenas Services." — `getDashboard()` monta este
 * objeto agregando as outras consultas já existentes (nenhuma lógica
 * nova, só composição — "evitar duplicação").
 */
export interface FinanceDashboard {
  currentBalance: number;
  monthIncome: number;
  monthExpenses: number;
  savings: number;
  topExpenseCategories: FinanceCategoryBreakdownItem[];
  recentTransactions: FinanceEntry[];
  monthlyEvolution: FinanceCashFlowPoint[];
}

export type { FinanceAccountBalance, FinanceCategoryBreakdownItem };
