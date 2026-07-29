import type { FinanceAccountKind, FinanceAccountStatus, FinanceEntryType, FinanceTransactionSort, FinanceTransactionSource, FinanceTransactionStatus, FinanceTransferDirection, FixedAccountOrigin, FixedAccountPaymentMethod, FixedAccountRecurrence } from '@control-os/types';

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
  status?: FinanceTransactionStatus;
  source?: FinanceTransactionSource;
  competenceDate?: string;
  dueDate?: string;
  paidAt?: string;
  confirmedAt?: string;
  canceledAt?: string;
  idempotencyKey?: string;
  idempotencyFingerprint?: string;
  correlationId?: string;
  reversalOfId?: string;
}

/**
 * Consulta já validada pelo FinanceService. Datas são instantes ISO em UTC;
 * os limites finais são inclusivos. O cursor nunca é aceito do cliente nesta
 * forma: o serviço decodifica e valida o contrato opaco primeiro.
 */
export interface FinanceTransactionPageQuery {
  limit: number;
  sort: FinanceTransactionSort;
  cursor?: { id: string; date: string };
  type?: FinanceEntryType;
  status?: FinanceTransactionStatus;
  accountId?: string;
  categoryId?: string;
  source?: FinanceTransactionSource;
  competenceFrom?: string;
  competenceTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  search?: string;
}

export interface FinanceTransactionPage {
  items: import('@control-os/types').FinanceEntry[];
  hasMore: boolean;
  cursorValid: boolean;
}

export interface CreateFinanceTransactionInput {
  type: FinanceEntryType;
  amount: number;
  description?: string;
  category?: string;
  categoryId?: string;
  date?: string;
  /** Cada transação pertence a uma conta resolvida pelo `FinanceService`; o Repository nunca resolve nome→id sozinho. */
  accountId?: string;
  competenceDate?: string;
  dueDate?: string;
  paidAt?: string;
  confirmedAt?: string;
  canceledAt?: string;
  status?: FinanceTransactionStatus;
  source?: FinanceTransactionSource;
  /** Chave estável fornecida pelo chamador para tornar reenvios idempotentes. */
  idempotencyKey?: string;
  idempotencyFingerprint?: string;
  /** Agrupa as duas pernas de uma transferência e seus estornos. */
  correlationId?: string;
  /** Referência ao lançamento preservado que esta movimentação estorna. */
  reversalOfId?: string;
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
  categoryId?: string;
  date?: string;
  accountId?: string;
  competenceDate?: string;
  dueDate?: string;
}

export interface TransactionAuditCommand {
  operation: string;
  source: FinanceAuditSource;
  correlationId?: string;
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
  currency: string;
  /** Valor exato em centavos; nunca usar float como origem do saldo inicial. */
  initialBalanceCents: number;
  openingBalanceDate: string;
  source: FinanceAuditSource;
}

export type FinanceAuditSource = 'manual' | 'nova' | 'whatsapp' | 'api' | 'system';

export interface FinanceAuditInput {
  operation: string;
  source: FinanceAuditSource;
  entityType: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export interface UpdateFinanceAccountInput {
  id: string;
  name?: string;
  currency?: string;
  source: FinanceAuditSource;
}

export interface SetFinanceAccountStatusInput {
  id: string;
  status: FinanceAccountStatus;
  source: FinanceAuditSource;
}

// --- CONTROL OS — Fase 7: Categorias ----------------------------------------

export interface CreateFinanceCategoryInput {
  name: string;
  kind: 'receita' | 'despesa';
  icon: string;
  color: string;
  sortOrder?: number;
  isFavorite?: boolean;
}

export interface UpdateFinanceCategoryInput {
  id: string;
  name?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  isFavorite?: boolean;
  source: FinanceAuditSource;
}

export interface SetFinanceCategoryStatusInput {
  id: string;
  status: 'ativa' | 'arquivada';
  source: FinanceAuditSource;
}

// --- CONTROL OS — Fase 7: Transferências e parcelamentos --------------------

/**
 * Uma transferência sempre gera DUAS `CreateFinanceTransactionInput`
 * (montadas por `FinanceService.createTransfer`, nunca pelo Repository —
 * "o Repository nunca decide regra de negócio, só persiste") — este tipo é
 * só o INPUT de alto nível que o Service recebe, já com as duas contas
 * resolvidas pelo serviço a partir de uma conta existente.
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

// --- Sprint 3.0: regras recorrentes e fatos de ocorrência -----------------

export interface CreateFixedAccountRepositoryInput {
  name: string;
  description?: string;
  type: 'receita' | 'despesa';
  origin: FixedAccountOrigin;
  categoryId: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  paymentMethod: FixedAccountPaymentMethod;
  amount: number;
  recurrence: FixedAccountRecurrence;
  customIntervalDays?: number;
  dueDay: number;
  startDate: string;
  endDate?: string;
  source: FinanceAuditSource;
}

export interface UpdateFixedAccountRepositoryInput extends Omit<Partial<CreateFixedAccountRepositoryInput>, 'source'> {
  id: string;
  active?: boolean;
  source: FinanceAuditSource;
}

export interface FixedAccountOccurrenceFilter {
  competence?: string;
  status?: 'pendente' | 'paga' | 'parcial' | 'cancelada' | 'atrasada';
  from?: string;
  to?: string;
  fixedAccountId?: string;
}

export interface CreateFixedAccountOccurrenceInput {
  fixedAccountId: string;
  competenceMonth: number;
  competenceYear: number;
  referencePeriod: string;
  dueDate: string;
  name: string;
  description?: string;
  type: 'receita' | 'despesa';
  origin: FixedAccountOrigin;
  categoryId: string;
  paymentMethod: FixedAccountPaymentMethod;
  sourceAccountId?: string;
  destinationAccountId?: string;
  amount: number;
}

export interface FixedAccountOccurrenceSettlementInput {
  occurrenceId: string;
  amount: number;
  source: FinanceAuditSource;
  idempotencyKey?: string;
  transaction: CreateFinanceTransactionInput;
}
