/**
 * Módulo Financeiro (CONTROL HUB — Fase 4: Action Engine real; Fase 6:
 * Persistência real — ganha Receitas + Consultas). `amount`/`category`/
 * `date` seguem o mesmo formato de `FinanceEntry` (`@control-os/types`) —
 * nenhuma forma nova inventada.
 */

export interface CreateExpenseInput {
  amount: number;
  description?: string;
  category?: string;
  /** ISO (`YYYY-MM-DD` ou timestamp completo) — quando ausente, a implementação ativa usa o momento da chamada. */
  date?: string;
}

export interface UpdateExpenseInput {
  id: string;
  amount?: number;
  description?: string;
  category?: string;
  date?: string;
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
}

export interface UpdateIncomeInput {
  id: string;
  amount?: number;
  description?: string;
  category?: string;
  date?: string;
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
