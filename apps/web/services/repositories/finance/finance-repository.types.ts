import type { FinanceAccountKind, FinanceEntryType, FinanceTransferDirection } from '@control-os/types';

/**
 * Tipos do Finance Repository (CONTROL OS — Fase 6: Persistência real;
 * Fase 7: Financeiro completo — contas, categorias, transferências,
 * parcelamentos). `amount`/`category`/`date` seguem o mesmo formato de
 * `FinanceEntry` (`@control-os/types`) — nenhuma forma nova inventada,
 * mesma convenção já usada por `CreateExpenseInput`
 * (`services/modules/finance/finance.types.ts`).
 */

/** Filtro usado tanto por `list` quanto por `getSummary`/`getCategoryBreakdown`/`getRecent` — "despesas do mês"/"receitas do mês"/"resumo financeiro"/"por categoria" são todos o mesmo filtro, só variando `type`/`from`/`to`/`accountId`. */
export interface FinanceTransactionFilter {
  type?: FinanceEntryType;
  /** ISO — início do intervalo, inclusive. */
  from?: string;
  /** ISO — fim do intervalo, inclusive. */
  to?: string;
  /** CONTROL OS — Fase 7: restringe a uma única conta (ex.: "saldo da Carteira"). */
  accountId?: string;
}

export interface CreateFinanceTransactionInput {
  type: FinanceEntryType;
  amount: number;
  description?: string;
  category?: string;
  date?: string;
  /** CONTROL OS — Fase 7: "cada transação deverá pertencer a uma conta" — resolvido (get-or-create) pelo `FinanceService` antes de chegar aqui; o Repository nunca resolve nome→id sozinho. */
  accountId?: string;
  /** Só preenchido em transações que são uma perna de transferência (`type === 'transferencia'`). */
  transferGroupId?: string;
  transferDirection?: FinanceTransferDirection;
  /** Só preenchido em transações que são uma parcela de um parcelamento. */
  installmentGroupId?: string;
  installmentNumber?: number;
  installmentTotal?: number;
  /** Só preenchido quando esta transação é a origem de uma recorrência. */
  recurrenceFrequency?: string;
}

export interface UpdateFinanceTransactionInput {
  id: string;
  amount?: number;
  description?: string;
  category?: string;
  date?: string;
  accountId?: string;
}

/** "Resumo financeiro"/"saldo atual" — uma forma só, reaproveitada pelos dois: saldo é `getSummary` sem filtro; resumo do mês é `getSummary` com `{from, to}` do mês. Soma só `receita`/`despesa` — `transferencia` nunca entra aqui (ver doc de `TransactionType.TRANSFER`, `schema.prisma`), "transferência não altera patrimônio total" sai de graça. */
export interface FinanceSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

// --- CONTROL OS — Fase 7: Contas -------------------------------------------

export interface CreateFinanceAccountInput {
  name: string;
  kind?: FinanceAccountKind;
}

// --- CONTROL OS — Fase 7: Categorias ----------------------------------------

export interface CreateFinanceCategoryInput {
  name: string;
  kind?: FinanceEntryType;
}

// --- CONTROL OS — Fase 7: Transferências e parcelamentos --------------------

/**
 * Uma transferência sempre gera DUAS `CreateFinanceTransactionInput`
 * (montadas por `FinanceService.createTransfer`, nunca pelo Repository —
 * "o Repository nunca decide regra de negócio, só persiste") — este tipo é
 * só o INPUT de alto nível que o Service recebe, já com as duas contas
 * resolvidas (get-or-create por nome).
 */
export interface CreateFinanceTransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  description?: string;
  date?: string;
}

/**
 * Um parcelamento sempre gera N `CreateFinanceTransactionInput` (uma por
 * parcela, montadas por `FinanceService.createInstallmentExpense`, mesmo
 * motivo acima) — este tipo é o INPUT de alto nível. `type` é quase sempre
 * `'despesa'` ("Parcela esse notebook em 12x"), mas `'receita'` também é
 * válido (ex.: um pagamento recebido parcelado) — nunca `'transferencia'`
 * (parcelamento não move dinheiro entre contas).
 */
export interface CreateFinanceInstallmentInput {
  type: 'receita' | 'despesa';
  totalAmount: number;
  installments: number;
  description?: string;
  category?: string;
  accountId?: string;
  /** ISO — data da primeira parcela; as demais são geradas +1 mês cada. Ausente = hoje. */
  startDate?: string;
}

// --- CONTROL OS — Fase 7: Consultas agregadas --------------------------------

export interface FinanceCategoryBreakdownItem {
  category: string;
  total: number;
}

export interface FinanceAccountBalance {
  accountId: string;
  accountName: string;
  balance: number;
}
