/**
 * Evolução "Parcelas & Empréstimos" — tipos do domínio `FinancialContract`/
 * `FinancialInstallment`. Espelha o mesmo estilo de `conversation-task.types.ts`:
 * tipos de borda (strings/números/ISO), nunca `Decimal`/`Date` do Prisma
 * cruzando para quem chama o serviço.
 */

export type FinancialContractType = 'LOAN' | 'FINANCING' | 'CARD_INSTALLMENT' | 'SUPPLIER';
export type FinancialContractOrigin = 'PERSONAL' | 'COMPANY';
export type FinancialContractSource = 'MANUAL' | 'NOVA' | 'DOCUMENT';
export type FinancialContractStatus = 'ACTIVE' | 'PAID_OFF' | 'CANCELLED';
export type FinancialInstallmentStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export type FinancialInstallment = {
  id: string;
  contractId: string;
  number: number;
  amount: number;
  dueDate: string;
  status: FinancialInstallmentStatus;
  paidAt: string | null;
  paymentTransactionId: string | null;
  createdAt: string;
};

export type FinancialContract = {
  id: string;
  userId: string;
  name: string;
  institution: string | null;
  type: FinancialContractType;
  origin: FinancialContractOrigin;
  categoryId: string | null;
  accountId: string | null;
  totalAmount: number;
  financedAmount: number | null;
  installmentAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  dueDay: number;
  startDate: string;
  endDate: string | null;
  interestRate: number | null;
  status: FinancialContractStatus;
  source: FinancialContractSource;
  documentId: string | null;
  createdAt: string;
  updatedAt: string;
  installments?: FinancialInstallment[];
};

export type CreateFinancialContractInput = {
  userId: string;
  name: string;
  institution?: string;
  type: FinancialContractType;
  origin?: FinancialContractOrigin;
  categoryId?: string;
  /** Conta debitada nos pagamentos. Opcional — ver doc do campo no schema.prisma. */
  accountId?: string;
  totalAmount: number;
  financedAmount?: number;
  totalInstallments: number;
  /**
   * Valor nominal de cada parcela (ex.: "42x de R$6.000"). Quando omitido, é
   * derivado de `totalAmount / totalInstallments` (split em centavos, sem
   * deriva de ponto flutuante — mesmo algoritmo de `buildInstallmentLegs`
   * em `finance.service.ts`). Quando informado, a ÚLTIMA parcela absorve
   * qualquer resto para que a soma bata exatamente com `totalAmount`.
   */
  installmentAmount?: number;
  dueDay: number;
  /** ISO — mês/ano da 1ª parcela. Ausente = agora. */
  startDate?: string;
  endDate?: string;
  interestRate?: number;
  source?: FinancialContractSource;
  documentId?: string;
};

export type PayFinancialInstallmentInput = {
  userId: string;
  installmentId: string;
  /** ISO — ausente = agora. */
  paidAt?: string;
  source?: 'manual' | 'nova' | 'whatsapp' | 'api';
};

export type PayFinancialInstallmentResult = {
  alreadyPaid: boolean;
  installment: FinancialInstallment;
  contract: FinancialContract;
};

export type UndoFinancialInstallmentPaymentInput = {
  userId: string;
  installmentId: string;
  source?: 'manual' | 'nova' | 'whatsapp' | 'api';
};

export type UndoFinancialInstallmentPaymentResult = {
  installment: FinancialInstallment;
  contract: FinancialContract;
};

export type FinancialInstallmentWithContract = FinancialInstallment & {
  contractName: string;
  contractInstitution: string | null;
};

export type FinancialDashboard = {
  /** Soma de todas as parcelas PENDING/OVERDUE (saldo devedor total). */
  outstandingBalance: { count: number; total: number };
  dueThisMonth: { count: number; total: number };
  paidThisMonth: { count: number; total: number };
  pending: { count: number; total: number };
  dueToday: FinancialInstallmentWithContract[];
  dueThisWeek: FinancialInstallmentWithContract[];
  overdue: FinancialInstallmentWithContract[];
};

/**
 * Resumo de um contrato (Fase 3, "contract detail") — derivado só das
 * parcelas já carregadas em `FinancialContract.installments`, nenhuma
 * consulta própria (mesmo princípio de `financial-reminder.service.ts`:
 * "nunca duplicar regras").
 */
export type FinancialContractSummary = {
  totalAmount: number;
  /** Soma das parcelas PAID. */
  paidAmount: number;
  /** Soma das parcelas PENDING/OVERDUE (exclui CANCELLED — quitação antecipada não é dívida em aberto). */
  remainingAmount: number;
  /** `paidAmount / totalAmount * 100`, 0-100, arredondado a 2 casas. `0` quando `totalAmount` é 0. */
  percentagePaid: number;
  /** Próxima parcela PENDING/OVERDUE por número. `null` quando não há nenhuma em aberto. */
  nextInstallment: FinancialInstallment | null;
  /** Parcelas PENDING/OVERDUE com `dueDate` antes de hoje. */
  overdueInstallments: FinancialInstallment[];
};

export type SettleFinancialContractInput = {
  userId: string;
  contractId: string;
  /** ISO — ausente = agora. Data de referência da quitação, vai para a auditoria. */
  settledAt?: string;
  source?: 'manual' | 'nova' | 'whatsapp' | 'api';
};

export type SettleFinancialContractResult = {
  contract: FinancialContract;
  /** Parcelas PENDING/OVERDUE que foram canceladas pela quitação (nunca inclui PAID — histórico é preservado). */
  cancelledInstallments: FinancialInstallment[];
};
