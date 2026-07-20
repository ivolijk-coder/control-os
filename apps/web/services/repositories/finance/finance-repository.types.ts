import type { FinanceEntryType } from '@control-os/types';

/**
 * Tipos do Finance Repository (CONTROL OS — Fase 6: Persistência real).
 * `amount`/`category`/`date` seguem o mesmo formato de `FinanceEntry`
 * (`@control-os/types`) — nenhuma forma nova inventada, mesma convenção já
 * usada por `CreateExpenseInput` (`services/modules/finance/finance.types.ts`).
 */

/** Filtro usado tanto por `list` quanto por `getSummary` — "despesas do mês"/"receitas do mês"/"resumo financeiro" são todos o mesmo filtro, só variando `type`/`from`/`to`. */
export interface FinanceTransactionFilter {
  type?: FinanceEntryType;
  /** ISO — início do intervalo, inclusive. */
  from?: string;
  /** ISO — fim do intervalo, inclusive. */
  to?: string;
}

export interface CreateFinanceTransactionInput {
  type: FinanceEntryType;
  amount: number;
  description?: string;
  category?: string;
  date?: string;
}

export interface UpdateFinanceTransactionInput {
  id: string;
  amount?: number;
  description?: string;
  category?: string;
  date?: string;
}

/** "Consultas: saldo atual, resumo financeiro" — uma forma só, reaproveitada pelos dois: saldo é `getSummary` sem filtro; resumo do mês é `getSummary` com `{from, to}` do mês. */
export interface FinanceSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}
