import { randomUUID } from 'node:crypto';
import type { FinanceAccount, FinanceCategory, FinanceEntry } from '@control-os/types';
import type { ActionResult } from '@/services/action-result.types';
import type { CreateFinanceTransactionInput, FinanceRepository } from '@/services/repositories';
import type { FinanceAuditSource } from '@/services/repositories/finance/finance-repository.types';
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
  UpdateFinanceAccountServiceInput,
  UpdateIncomeInput,
  CreateTransactionServiceInput,
  UpdateTransactionServiceInput,
  CreateFixedAccountInput,
  UpdateFixedAccountInput,
  FixedAccountOccurrenceQuery,
  PayFixedAccountOccurrenceInput,
} from './finance.types';
import { FixedAccountGenerationService } from './fixed-account-generation.service';

/**
 * CONTROL OS — Fase 6: Todo `Prisma*Repository` guarda dados por `userId`
 * (multi-tenant, ver `schema.prisma`). Toda operação persistente precisa de
 * um usuário autenticado; não há mais usuário padrão oculto.
 */

/**
 * Catálogo de categorias padrão do sistema. Ele aparece para todo usuário e
 * é materializado no banco quando usado ou personalizado, permitindo que um
 * lançamento sempre guarde uma FK real para `finance_categories`.
 */
const DEFAULT_FINANCE_CATEGORIES = [
  ['Alimentação', 'despesa', 'utensils', '#F97316'], ['Mercado', 'despesa', 'shopping-basket', '#22C55E'], ['Combustível', 'despesa', 'fuel', '#EAB308'], ['Saúde', 'despesa', 'heart-pulse', '#EF4444'], ['Educação', 'despesa', 'graduation-cap', '#8B5CF6'], ['Trabalho', 'despesa', 'briefcase', '#3B82F6'], ['Moradia', 'despesa', 'house', '#06B6D4'], ['Internet', 'despesa', 'wifi', '#0EA5E9'], ['Energia', 'despesa', 'zap', '#F59E0B'], ['Água', 'despesa', 'droplets', '#38BDF8'], ['Investimentos', 'receita', 'trending-up', '#10B981'], ['Salário', 'receita', 'wallet-cards', '#22C55E'], ['Freelance', 'receita', 'rocket', '#6366F1'],
] as const;


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
  categoryId?: string;
  accountId: string;
  startDate?: string;
}): CreateFinanceTransactionInput[] {
  const { type, totalAmount, installments, description, category, categoryId, accountId, startDate } = params;
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
      categoryId,
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
    private readonly explicitUserId?: string
  ) {}

  private get userId(): string {
    const userId = currentFinanceUserId() ?? this.explicitUserId;
    if (!userId) throw new Error('Operação financeira requer um usuário autenticado.');
    return userId;
  }

  // --- Resolução de conta (CONTROL OS — Fase 7) ------------------------------

  /**
   * Toda transação deve apontar para uma conta existente e ativa. Para
   * compatibilidade, uma conta única já existente pode ser usada quando a
   * origem ainda não informar uma conta; jamais criamos uma conta implícita.
   */
  private async resolveAccountId(accountId?: string, accountName?: string): Promise<string | undefined> {
    if (accountId) {
      const account = await this.repository.findAccountById(this.userId, accountId);
      return account?.status === 'ativa' ? account.id : undefined;
    }
    if (accountName?.trim()) {
      const account = await this.repository.findAccountByName(this.userId, accountName.trim());
      return account?.status === 'ativa' ? account.id : undefined;
    }
    const accounts = await this.repository.listAccounts(this.userId);
    return accounts.length === 1 ? accounts[0]?.id : undefined;
  }

  private accountRequiredResult(): ActionResult {
    return { success: false, message: 'Selecione uma conta bancária ativa antes de registrar a movimentação.' };
  }

  /** Resolve e materializa categorias padrão no catálogo pessoal antes de
   * persistir um lançamento. Assim todo lançamento novo tem FK real, sem
   * quebrar os textos e transações legadas já existentes. */
  private async resolveCategory(input: { category?: string; categoryId?: string }, kind: 'receita' | 'despesa'): Promise<{ id: string; name: string } | undefined> {
    if (input.categoryId) {
      const found = await this.repository.findCategoryById(this.userId, input.categoryId);
      if (found?.status === 'ativa' && found.kind === kind) return { id: found.id, name: found.name };
      // Categorias padrão começam como IDs virtuais. Ao serem escolhidas
      // para um lançamento, tornam-se uma categoria real do proprietário.
      if (input.categoryId.startsWith('default:')) {
        const name = input.categoryId.slice('default:'.length);
        const definition = DEFAULT_FINANCE_CATEGORIES.find(([candidate, candidateKind]) => candidate === name && candidateKind === kind);
        if (definition) {
          const category = await this.repository.createCategory(this.userId, {
            name: definition[0], kind, icon: definition[2], color: definition[3],
          });
          return { id: category.id, name: category.name };
        }
      }
      return undefined;
    }
    const name = input.category?.trim() || 'Outros';
    const existing = await this.repository.findCategoryByName(this.userId, name);
    if (existing?.status === 'ativa' && (!existing.kind || existing.kind === kind)) return { id: existing.id, name: existing.name };
    const definition = DEFAULT_FINANCE_CATEGORIES.find(([candidate, candidateKind]) => candidate.toLowerCase() === name.toLowerCase() && candidateKind === kind);
    const category = await this.repository.createCategory(this.userId, definition
      ? { name: definition[0], kind, icon: definition[2], color: definition[3] }
      : { name, kind, icon: 'tag', color: '#6366F1' });
    return { id: category.id, name: category.name };
  }

  // --- Núcleo de transações (Sprint 2.1) -----------------------------------

  async listTransactions(): Promise<FinanceEntry[]> { return this.repository.list(this.userId); }

  // --- Contas fixas e ocorrências (Sprint 3.0) ----------------------------
  async createFixedAccount(input: CreateFixedAccountInput): Promise<ActionResult> {
    if (!input.name.trim() || !(input.amount > 0) || !Number.isInteger(input.dueDay) || input.dueDay < 1 || input.dueDay > 31) return { success: false, message: 'Informe nome, valor e dia de vencimento válidos.' };
    // A regra de origem/destino existe, mas uma conta fixa pode nascer sem
    // conta bancária (boleto, dinheiro ou uma futura fatura de cartão). A
    // baixa só é permitida quando a ocorrência tiver uma conta compatível.
    if (input.paymentMethod === 'conta_bancaria' && input.type === 'despesa' && !input.sourceAccountId) return { success: false, message: 'Selecione a conta de origem da despesa recorrente.' };
    if (input.paymentMethod === 'conta_bancaria' && input.type === 'receita' && !input.destinationAccountId) return { success: false, message: 'Selecione a conta de destino da receita recorrente.' };
    const category = await this.resolveCategory({ categoryId: input.categoryId }, input.type);
    if (!category) return { success: false, message: 'Selecione uma categoria ativa compatível.' };
    const accountId = input.type === 'despesa' ? input.sourceAccountId : input.destinationAccountId;
    if (accountId && !await this.resolveAccountId(accountId)) return this.accountRequiredResult();
    const created = await this.repository.createFixedAccount(this.userId, { ...input, origin: input.origin ?? 'pessoal', recurrence: input.recurrence ?? 'mensal', categoryId: category.id, source: input.source ?? 'manual' });
    await this.generateFixedAccountOccurrences(new Date(new Date().getFullYear(), new Date().getMonth() + 3, 0).toISOString());
    return { success: true, message: 'Conta fixa criada.', data: created };
  }
  async listFixedAccounts(options?: { includeArchived?: boolean }) { return this.repository.listFixedAccounts(this.userId, options); }
  async updateFixedAccount(input: UpdateFixedAccountInput): Promise<ActionResult> {
    const current = await this.repository.findFixedAccountById(this.userId, input.id);
    if (!current) return { success: false, message: 'Conta fixa não encontrada.' };
    const type = input.type ?? current.type;
    const sourceAccountId = input.sourceAccountId ?? current.sourceAccountId;
    const destinationAccountId = input.destinationAccountId ?? current.destinationAccountId;
    const paymentMethod = input.paymentMethod ?? current.paymentMethod;
    if (paymentMethod === 'conta_bancaria' && type === 'despesa' && !sourceAccountId) return { success: false, message: 'Selecione a conta de origem da despesa recorrente.' };
    if (paymentMethod === 'conta_bancaria' && type === 'receita' && !destinationAccountId) return { success: false, message: 'Selecione a conta de destino da receita recorrente.' };
    const accountId = type === 'despesa' ? sourceAccountId : destinationAccountId;
    if (accountId && !await this.resolveAccountId(accountId)) return this.accountRequiredResult();
    const categoryId = input.categoryId ?? current.categoryId;
    const category = await this.resolveCategory({ categoryId }, type);
    if (!category) return { success: false, message: 'Categoria inválida.' };
    const updated = await this.repository.updateFixedAccount(this.userId, {
      ...input,
      description: input.description ?? undefined,
      // `undefined` significa "não alterar"; `null` limpa explicitamente o
      // vínculo para as novas ocorrências. Snapshots antigos são imutáveis.
      sourceAccountId: input.sourceAccountId === undefined ? current.sourceAccountId : input.sourceAccountId ?? undefined,
      destinationAccountId: input.destinationAccountId === undefined ? current.destinationAccountId : input.destinationAccountId ?? undefined,
      endDate: input.endDate ?? undefined,
      customIntervalDays: input.customIntervalDays ?? undefined,
      categoryId: category.id,
      source: input.source ?? 'manual',
    });
    return updated ? { success: true, message: 'Conta fixa atualizada. Ocorrências já criadas foram preservadas.', data: updated } : { success: false, message: 'Conta fixa não encontrada.' };
  }
  async archiveFixedAccount(id: string, source: FinanceAuditSource = 'manual'): Promise<ActionResult> { const item = await this.repository.setFixedAccountArchived(this.userId, id, true, source); return item ? { success: true, message: 'Conta fixa arquivada.', data: item } : { success: false, message: 'Conta fixa não encontrada.' }; }
  async restoreFixedAccount(id: string, source: FinanceAuditSource = 'manual'): Promise<ActionResult> { const item = await this.repository.setFixedAccountArchived(this.userId, id, false, source); return item ? { success: true, message: 'Conta fixa restaurada.', data: item } : { success: false, message: 'Conta fixa não encontrada.' }; }
  async generateFixedAccountOccurrences(until?: Date | string): Promise<ActionResult> {
    const limit = until ? new Date(until) : new Date(new Date().getFullYear(), new Date().getMonth() + 3, 0);
    if (Number.isNaN(limit.getTime())) return { success: false, message: 'Data final inválida.' };
    const generator = new FixedAccountGenerationService(); const accounts = await this.repository.listFixedAccounts(this.userId);
    const generated = [];
    for (const account of accounts) generated.push(...await this.repository.createFixedAccountOccurrences(this.userId, generator.build(account, limit), 'system'));
    return { success: true, message: `${generated.length} ocorrência(s) gerada(s).`, data: generated };
  }
  async listFixedAccountOccurrences(query?: FixedAccountOccurrenceQuery) { await this.generateFixedAccountOccurrences(); return this.repository.listFixedAccountOccurrences(this.userId, query); }
  async payFixedAccountOccurrence(input: PayFixedAccountOccurrenceInput): Promise<ActionResult> {
    const occurrence = await this.repository.findFixedAccountOccurrenceById(this.userId, input.id);
    if (!occurrence) return { success: false, message: 'Ocorrência não encontrada.' };
    if (occurrence.status === 'cancelada' || occurrence.status === 'paga') return { success: false, message: 'Esta ocorrência não pode mais ser paga.' };
    const accountId = occurrence.type === 'despesa' ? occurrence.sourceAccountId : occurrence.destinationAccountId;
    if (!accountId) return { success: false, message: 'Esta ocorrência não possui uma conta bancária para baixa. Configure a conta fixa antes de pagar novas ocorrências.' };
    const amount = input.amount ?? occurrence.amount - occurrence.paidAmount;
    if (!(amount > 0)) return { success: false, message: 'Informe um valor de pagamento válido.' };
    const paidAt = input.paidAt ?? new Date().toISOString();
    if (Number.isNaN(new Date(paidAt).getTime())) return { success: false, message: 'Data de pagamento inválida.' };
    const result = await this.repository.recordFixedAccountOccurrencePayment(this.userId, { occurrenceId: occurrence.id, amount, source: input.source ?? 'manual', idempotencyKey: input.idempotencyKey, transaction: { type: occurrence.type, amount, description: occurrence.name, categoryId: occurrence.categoryId, accountId, competenceDate: occurrence.dueDate, dueDate: occurrence.dueDate, paidAt, status: 'confirmada', source: input.source ?? 'manual', idempotencyKey: input.idempotencyKey } });
    return result ? { success: true, message: result.occurrence.status === 'paga' ? 'Conta marcada como paga.' : 'Pagamento parcial registrado.', data: result } : { success: false, message: 'Não foi possível baixar esta ocorrência.' };
  }
  async cancelFixedAccountOccurrence(id: string, source: FinanceAuditSource = 'manual'): Promise<ActionResult> { const item = await this.repository.cancelFixedAccountOccurrence(this.userId, id, source); return item ? { success: true, message: 'Ocorrência cancelada.', data: item } : { success: false, message: 'Somente ocorrências pendentes podem ser canceladas.' }; }

  async createTransaction(input: CreateTransactionServiceInput): Promise<ActionResult> {
    if (!(input.amount > 0)) return { success: false, message: 'O valor precisa ser maior que zero.' };
    const source = input.source ?? 'manual';
    const status = input.status ?? 'confirmada';
    if (status !== 'pendente' && status !== 'confirmada') return { success: false, message: 'Uma transação nova só pode nascer pendente ou confirmada.' };
    if (status === 'pendente' && input.paidAt) return { success: false, message: 'Uma transação pendente não pode possuir data de pagamento.' };
    if (input.idempotencyKey) {
      const previous = await this.repository.findByIdempotencyKey(this.userId, input.idempotencyKey);
      if (previous) return { success: true, message: 'Esta operação já havia sido processada.', data: previous };
    }
    const competenceDate = input.competenceDate ?? new Date().toISOString();
    if (Number.isNaN(new Date(competenceDate).getTime()) || (input.dueDate && Number.isNaN(new Date(input.dueDate).getTime()))) return { success: false, message: 'A data informada é inválida.' };
    const correlationId = randomUUID();

    if (input.type === 'transferencia') {
      if (!input.fromAccountId || !input.toAccountId) return this.accountRequiredResult();
      if (input.fromAccountId === input.toAccountId) return { success: false, message: 'A conta de origem e a de destino não podem ser a mesma.' };
      const [from, to] = await Promise.all([this.resolveAccountId(input.fromAccountId), this.resolveAccountId(input.toAccountId)]);
      if (!from || !to) return this.accountRequiredResult();
      const group = randomUUID();
      let entries: FinanceEntry[];
      try {
        entries = await this.repository.createManyWithAudit(this.userId, [
          { type: 'transferencia', amount: input.amount, description: input.description, accountId: from, date: competenceDate, competenceDate, dueDate: input.dueDate, status, source, transferGroupId: group, transferDirection: 'saida', correlationId, idempotencyKey: input.idempotencyKey },
          { type: 'transferencia', amount: input.amount, description: input.description, accountId: to, date: competenceDate, competenceDate, dueDate: input.dueDate, status, source, transferGroupId: group, transferDirection: 'entrada', correlationId },
        ], { operation: 'transaction.transfer.created', source, correlationId });
      } catch (error) {
        const previous = input.idempotencyKey ? await this.repository.findByIdempotencyKey(this.userId, input.idempotencyKey) : undefined;
        if (previous) return { success: true, message: 'Esta operação já havia sido processada.', data: previous };
        throw error;
      }
      return { success: true, message: 'Transferência registrada.', data: { out: entries[0], in: entries[1] } };
    }

    if (!input.accountId) return this.accountRequiredResult();
    const accountId = await this.resolveAccountId(input.accountId);
    if (!accountId) return this.accountRequiredResult();
    if (!input.categoryId) return { success: false, message: 'Selecione uma categoria ativa para a transação.' };
    const category = await this.resolveCategory({ categoryId: input.categoryId }, input.type);
    if (!category) return { success: false, message: 'Selecione uma categoria ativa compatível com a transação.' };
    let entry: FinanceEntry;
    try {
      entry = await this.repository.createWithAudit(this.userId, {
        type: input.type, amount: input.amount, description: input.description, category: category.name, categoryId: category.id, accountId,
        date: competenceDate, competenceDate, dueDate: input.dueDate, paidAt: input.paidAt, status, source, idempotencyKey: input.idempotencyKey, correlationId,
      }, { operation: 'transaction.created', source, correlationId });
    } catch (error) {
      const previous = input.idempotencyKey ? await this.repository.findByIdempotencyKey(this.userId, input.idempotencyKey) : undefined;
      if (previous) return { success: true, message: 'Esta operação já havia sido processada.', data: previous };
      throw error;
    }
    return { success: true, message: `${input.type === 'receita' ? 'Receita' : 'Despesa'} registrada.`, data: entry };
  }

  async updateTransaction(input: UpdateTransactionServiceInput): Promise<ActionResult> {
    const existing = await this.repository.findById(this.userId, input.id);
    if (!existing) return { success: false, message: 'Transação não encontrada.' };
    if (existing.status !== 'pendente') return { success: false, message: 'Somente transações pendentes podem ser editadas.' };
    if (existing.type === 'transferencia') return { success: false, message: 'Edite ou reverta uma transferência pelo fluxo próprio.' };
    if (input.amount !== undefined && !(input.amount > 0)) return { success: false, message: 'O valor precisa ser maior que zero.' };
    const accountId = input.accountId ? await this.resolveAccountId(input.accountId) : undefined;
    if (input.accountId && !accountId) return this.accountRequiredResult();
    let category: { id: string; name: string } | undefined;
    if (input.categoryId) { category = await this.resolveCategory({ categoryId: input.categoryId }, existing.type); if (!category) return { success: false, message: 'Categoria inválida ou arquivada.' }; }
    const source = input.source ?? 'manual'; const correlationId = randomUUID();
    const entry = await this.repository.updateWithAudit(this.userId, { id: input.id, amount: input.amount, description: input.description, accountId, categoryId: category?.id, category: category?.name, date: input.competenceDate, competenceDate: input.competenceDate, dueDate: input.dueDate }, { operation: 'transaction.updated', source, correlationId });
    return entry ? { success: true, message: 'Transação atualizada.', data: entry } : { success: false, message: 'Não foi possível atualizar a transação.' };
  }

  async confirmTransaction(id: string, source: 'manual' | 'nova' | 'whatsapp' | 'api' = 'manual'): Promise<ActionResult> {
    const entry = await this.repository.findById(this.userId, id);
    if (!entry) return { success: false, message: 'Transação não encontrada.' };
    if (entry.status !== 'pendente') return { success: false, message: 'Somente transações pendentes podem ser confirmadas.' };
    const changed = await this.repository.transitionWithAudit(this.userId, id, 'confirmada', { operation: 'transaction.confirmed', source, correlationId: randomUUID() });
    return changed ? { success: true, message: 'Pagamento confirmado.', data: changed } : { success: false, message: 'Não foi possível confirmar a transação.' };
  }

  async cancelTransaction(id: string, source: 'manual' | 'nova' | 'whatsapp' | 'api' = 'manual'): Promise<ActionResult> {
    const entry = await this.repository.findById(this.userId, id);
    if (!entry) return { success: false, message: 'Transação não encontrada.' };
    if (entry.status !== 'pendente') return { success: false, message: 'Somente transações pendentes podem ser canceladas.' };
    const changed = await this.repository.transitionWithAudit(this.userId, id, 'cancelada', { operation: 'transaction.canceled', source, correlationId: randomUUID() });
    return changed ? { success: true, message: 'Transação cancelada. O histórico foi preservado.', data: changed } : { success: false, message: 'Não foi possível cancelar a transação.' };
  }

  async reverseTransaction(id: string, source: 'manual' | 'nova' | 'whatsapp' | 'api' = 'manual'): Promise<ActionResult> {
    const entry = await this.repository.findById(this.userId, id);
    if (!entry) return { success: false, message: 'Transação não encontrada.' };
    if (entry.status !== 'confirmada') return { success: false, message: 'Somente transações confirmadas podem ser estornadas.' };
    const originals = entry.type === 'transferencia' && entry.transferGroupId
      ? (await this.repository.list(this.userId)).filter((candidate) => candidate.transferGroupId === entry.transferGroupId)
      : [entry];
    if (originals.some((original) => original.status !== 'confirmada')) return { success: false, message: 'Esta transação já foi cancelada ou estornada.' };
    const correlationId = randomUUID(); const reversalGroupId = entry.type === 'transferencia' ? randomUUID() : undefined;
    const reversals = originals.map((original) => ({
      type: original.type === 'receita' ? 'despesa' as const : original.type === 'despesa' ? 'receita' as const : 'transferencia' as const,
      amount: original.amount, description: `Estorno: ${original.description}`, category: original.category, categoryId: original.categoryId, accountId: original.accountId,
      // O lançamento inverso é um rastro técnico do estorno. O saldo volta a
      // ser calculado sem o original (agora estornado), portanto esta perna
      // também não pode voltar a impactar o realizado.
      date: new Date().toISOString(), competenceDate: new Date().toISOString(), status: 'estornada' as const, source,
      transferGroupId: reversalGroupId, transferDirection: original.type === 'transferencia' ? (original.transferDirection === 'entrada' ? 'saida' as const : 'entrada' as const) : undefined,
      reversalOfId: original.id, correlationId,
    }));
    const changed = await this.repository.reverseWithAudit(this.userId, originals, reversals, { operation: 'transaction.reversed', source, correlationId });
    return changed ? { success: true, message: 'Estorno registrado; o lançamento original foi preservado.', data: changed } : { success: false, message: 'Não foi possível estornar a transação.' };
  }

  // --- Despesas -----------------------------------------------------------

  async createExpense(input: CreateExpenseInput): Promise<ActionResult> {
    const accountId = await this.resolveAccountId(input.accountId, input.accountName);
    if (!accountId) return this.accountRequiredResult();
    const category = await this.resolveCategory(input, 'despesa');
    if (!category) return { success: false, message: 'Selecione uma categoria de despesa ativa.' };
    return this.createTransaction({ type: 'despesa', amount: input.amount, description: input.description, categoryId: category.id, accountId, competenceDate: input.date, source: input.source ?? 'manual', idempotencyKey: input.idempotencyKey });
  }

  async updateExpense(input: UpdateExpenseInput): Promise<ActionResult> {
    const existing = await this.requireEntryOfType(input.id, 'despesa', 'despesa');
    if (!existing.success) return existing;
    const accountId = input.accountId ?? (input.accountName ? await this.resolveAccountId(undefined, input.accountName) : undefined);
    if ((input.accountId || input.accountName) && !accountId) return this.accountRequiredResult();
    const category = input.categoryId || input.category ? await this.resolveCategory(input, 'despesa') : undefined;
    if ((input.categoryId || input.category) && !category) return { success: false, message: 'Selecione uma categoria de despesa ativa.' };
    return this.updateTransaction({ id: input.id, amount: input.amount, description: input.description, accountId, categoryId: category?.id, competenceDate: input.date, source: 'manual' });
  }

  async deleteExpense(input: DeleteExpenseInput): Promise<ActionResult> {
    const existing = await this.requireEntryOfType(input.id, 'despesa', 'despesa');
    if (!existing.success) return existing;

    return this.cancelTransaction(input.id, 'manual');
  }

  async listExpenses(): Promise<FinanceEntry[]> {
    return this.repository.list(this.userId, { type: 'despesa' });
  }

  // --- Receitas -------------------------------------------------------------

  async createIncome(input: CreateIncomeInput): Promise<ActionResult> {
    const accountId = await this.resolveAccountId(input.accountId, input.accountName);
    if (!accountId) return this.accountRequiredResult();
    const category = await this.resolveCategory(input, 'receita');
    if (!category) return { success: false, message: 'Selecione uma categoria de receita ativa.' };
    return this.createTransaction({ type: 'receita', amount: input.amount, description: input.description, categoryId: category.id, accountId, competenceDate: input.date, source: input.source ?? 'manual', idempotencyKey: input.idempotencyKey });
  }

  async updateIncome(input: UpdateIncomeInput): Promise<ActionResult> {
    const existing = await this.requireEntryOfType(input.id, 'receita', 'receita');
    if (!existing.success) return existing;
    const accountId = input.accountId ?? (input.accountName ? await this.resolveAccountId(undefined, input.accountName) : undefined);
    if ((input.accountId || input.accountName) && !accountId) return this.accountRequiredResult();
    const category = input.categoryId || input.category ? await this.resolveCategory(input, 'receita') : undefined;
    if ((input.categoryId || input.category) && !category) return { success: false, message: 'Selecione uma categoria de receita ativa.' };
    return this.updateTransaction({ id: input.id, amount: input.amount, description: input.description, accountId, categoryId: category?.id, competenceDate: input.date, source: 'manual' });
  }

  async deleteIncome(input: DeleteIncomeInput): Promise<ActionResult> {
    const existing = await this.requireEntryOfType(input.id, 'receita', 'receita');
    if (!existing.success) return existing;

    return this.cancelTransaction(input.id, 'manual');
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
    if (!fromAccountId || !toAccountId) return this.accountRequiredResult();
    if (fromAccountId === toAccountId) {
      return { success: false, message: 'A conta de origem e a de destino não podem ser a mesma.' };
    }

    const description = input.description ?? `Transferência para ${toAccountName}`;
    return this.createTransaction({ type: 'transferencia', amount: input.amount, description, fromAccountId, toAccountId, competenceDate: input.date, source: input.source ?? 'manual', idempotencyKey: input.idempotencyKey });
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
    if (!accountId) return this.accountRequiredResult();
    const category = await this.resolveCategory(input, type);
    if (!category) return { success: false, message: 'Selecione uma categoria ativa compatível com o parcelamento.' };
    const legs = buildInstallmentLegs({
      type,
      totalAmount: input.totalAmount,
      installments: input.installments,
      description: input.description,
      category: category.name,
      categoryId: category.id,
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
    if (!accountId) return this.accountRequiredResult();
    const category = await this.resolveCategory(input, type);
    if (!category) return { success: false, message: 'Selecione uma categoria ativa compatível com a recorrência.' };
    const entry = await this.repository.create(this.userId, {
      type,
      amount: input.amount,
      description: input.description,
      category: category.name,
      categoryId: category.id,
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
    const currency = (input.currency ?? 'BRL').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      return { success: false, message: 'Informe uma moeda ISO válida, por exemplo BRL.' };
    }
    const initialBalanceCents = input.initialBalanceCents ?? 0;
    if (!Number.isSafeInteger(initialBalanceCents)) {
      return { success: false, message: 'O saldo inicial deve ser informado em centavos inteiros.' };
    }
    const openingBalanceDate = input.openingBalanceDate ?? new Date().toISOString();
    if (Number.isNaN(new Date(openingBalanceDate).getTime())) {
      return { success: false, message: 'A data do saldo inicial é inválida.' };
    }
    const account = await this.repository.createAccount(this.userId, {
      name,
      kind: input.kind,
      currency,
      initialBalanceCents,
      openingBalanceDate,
      source: input.source ?? 'manual',
    });
    return { success: true, message: `Conta "${account.name}" criada.`, data: account };
  }

  async listAccounts(options?: { includeArchived?: boolean }): Promise<FinanceAccount[]> {
    return this.repository.listAccounts(this.userId, options);
  }

  async updateAccount(input: UpdateFinanceAccountServiceInput): Promise<ActionResult> {
    const existing = await this.repository.findAccountById(this.userId, input.id);
    if (!existing) return { success: false, message: 'Conta não encontrada.' };

    const name = input.name?.trim();
    if (input.name !== undefined && !name) return { success: false, message: 'O nome da conta não pode ficar vazio.' };
    if (name && name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await this.repository.findAccountByName(this.userId, name);
      if (duplicate && duplicate.id !== existing.id) return { success: false, message: `Já existe uma conta chamada "${duplicate.name}".` };
    }

    const currency = input.currency?.trim().toUpperCase();
    if (currency && !/^[A-Z]{3}$/.test(currency)) return { success: false, message: 'Informe uma moeda ISO válida, por exemplo BRL.' };
    if (currency && currency !== existing.currency && (await this.repository.hasAccountMovements(this.userId, existing.id))) {
      return { success: false, message: 'A moeda não pode ser alterada após a primeira movimentação.' };
    }

    const account = await this.repository.updateAccount(this.userId, {
      id: input.id,
      name,
      currency,
      source: input.source ?? 'manual',
    });
    return account
      ? { success: true, message: `Conta "${account.name}" atualizada.`, data: account }
      : { success: false, message: 'Não foi possível atualizar a conta.' };
  }

  async archiveAccount(id: string, source: 'manual' | 'nova' | 'whatsapp' | 'api' = 'manual'): Promise<ActionResult> {
    const account = await this.repository.setAccountStatus(this.userId, { id, status: 'arquivada', source });
    return account
      ? { success: true, message: `Conta "${account.name}" arquivada. O histórico foi preservado.`, data: account }
      : { success: false, message: 'Conta não encontrada.' };
  }

  async restoreAccount(id: string, source: 'manual' | 'nova' | 'whatsapp' | 'api' = 'manual'): Promise<ActionResult> {
    const account = await this.repository.setAccountStatus(this.userId, { id, status: 'ativa', source });
    return account
      ? { success: true, message: `Conta "${account.name}" restaurada.`, data: account }
      : { success: false, message: 'Conta não encontrada.' };
  }

  // --- Categorias -------------------------------------------------------------

  async createCategory(input: CreateFinanceCategoryServiceInput): Promise<ActionResult> {
    const name = input.name.trim();
    if (!name) {
      return { success: false, message: 'Preciso de um nome para criar a categoria.' };
    }
    const existingCustom = (await this.repository.listCategories(this.userId)).find(
      (candidate) => candidate.name.toLowerCase() === name.toLowerCase()
    );
    if (existingCustom) {
      return { success: false, message: `Já existe uma categoria personalizada chamada "${existingCustom.name}".` };
    }
    const category = await this.repository.createCategory(this.userId, {
      name,
      kind: input.kind,
      icon: input.icon?.trim() || 'tag',
      color: input.color?.trim() || '#6366F1',
      sortOrder: Math.max(0, Math.trunc(input.sortOrder ?? 0)),
      isFavorite: input.isFavorite ?? false,
    });
    return { success: true, message: `Categoria "${category.name}" criada.`, data: category };
  }

  async listCategories(options?: { includeArchived?: boolean }): Promise<FinanceCategory[]> {
    const persisted = await this.repository.listCategories(this.userId, { includeArchived: true });
    const visible = options?.includeArchived
      ? persisted
      : persisted.filter((category) => category.status === 'ativa');
    const materializedNames = new Set(persisted.map((category) => category.name.toLocaleLowerCase('pt-BR')));
    const defaults = DEFAULT_FINANCE_CATEGORIES
      .filter(([name]) => !materializedNames.has(name.toLocaleLowerCase('pt-BR')))
      .map(([name, kind, icon, color]) => ({
        id: `default:${name.toLocaleLowerCase('pt-BR')}`,
        name,
        kind,
        icon,
        color,
        status: 'ativa' as const,
        sortOrder: 0,
        isFavorite: false,
        createdAt: new Date(0).toISOString(),
        isDefault: true,
      }));
    return [...defaults, ...visible].sort((left, right) => Number(right.isFavorite) - Number(left.isFavorite) || left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'pt-BR'));
  }

  async updateCategory(input: import('./finance.types').UpdateFinanceCategoryServiceInput): Promise<ActionResult> {
    const name = input.name?.trim(); if (input.name !== undefined && !name) return { success: false, message: 'O nome da categoria não pode ficar vazio.' };
    if (name) { const duplicate = await this.repository.findCategoryByName(this.userId, name); if (duplicate && duplicate.id !== input.id) return { success: false, message: `Já existe uma categoria chamada "${duplicate.name}".` }; }
    if (input.sortOrder !== undefined && (!Number.isInteger(input.sortOrder) || input.sortOrder < 0)) return { success: false, message: 'A ordem precisa ser um número inteiro igual ou maior que zero.' };
    const category = await this.repository.updateCategory(this.userId, { id: input.id, name, icon: input.icon?.trim(), color: input.color?.trim(), sortOrder: input.sortOrder, isFavorite: input.isFavorite, source: input.source ?? 'manual' });
    return category ? { success: true, message: `Categoria "${category.name}" atualizada.`, data: category } : { success: false, message: 'Categoria não encontrada.' };
  }

  async archiveCategory(id: string, source: 'manual' | 'nova' | 'whatsapp' | 'api' = 'manual'): Promise<ActionResult> {
    const category = await this.repository.setCategoryStatus(this.userId, { id, status: 'arquivada', source });
    return category ? { success: true, message: `Categoria "${category.name}" arquivada. O histórico foi preservado.`, data: category } : { success: false, message: 'Categoria não encontrada.' };
  }
  async restoreCategory(id: string, source: 'manual' | 'nova' | 'whatsapp' | 'api' = 'manual'): Promise<ActionResult> {
    const category = await this.repository.setCategoryStatus(this.userId, { id, status: 'ativa', source });
    return category ? { success: true, message: `Categoria "${category.name}" restaurada.`, data: category } : { success: false, message: 'Categoria não encontrada.' };
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
