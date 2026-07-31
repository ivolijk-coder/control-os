import type { CreateFinanceTransactionInput, FinanceMutationResult } from './finance-api-client';

export type CreateTransactionType = CreateFinanceTransactionInput['type'];

export interface CreateTransactionFormValues {
  type: CreateTransactionType;
  accountId: string;
  fromAccountId: string;
  toAccountId: string;
  categoryId: string;
  description: string;
  amount: string;
  competenceDate: string;
  dueDate: string;
  paidAt: string;
}

export type CreateTransactionValidation =
  | { success: true; input: CreateFinanceTransactionInput }
  | { success: false; message: string };

export type CreateTransactionSubmissionResult =
  | { kind: 'ignored' }
  | { kind: 'validation_error'; message: string }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

export function emptyCreateTransactionForm(): CreateTransactionFormValues {
  return {
    type: 'despesa',
    accountId: '',
    fromAccountId: '',
    toAccountId: '',
    categoryId: '',
    description: '',
    amount: '',
    competenceDate: '',
    dueDate: '',
    paidAt: '',
  };
}

export function buildCreateFinanceTransactionInput(
  values: CreateTransactionFormValues,
  idempotencyKey: string
): CreateTransactionValidation {
  const amount = parseCurrencyInput(values.amount);
  if (amount === undefined || amount <= 0) {
    return { success: false, message: 'Informe um valor válido maior que zero.' };
  }

  const description = values.description.trim();
  if (!description) return { success: false, message: 'Informe uma descrição.' };

  if (values.type === 'transferencia') {
    if (!values.fromAccountId || !values.toAccountId) {
      return { success: false, message: 'Selecione as contas de origem e destino.' };
    }
    return {
      success: true,
      input: {
        type: values.type,
        amount,
        description,
        fromAccountId: values.fromAccountId,
        toAccountId: values.toAccountId,
        competenceDate: optionalDate(values.competenceDate),
        dueDate: optionalDate(values.dueDate),
        paidAt: optionalDate(values.paidAt),
        idempotencyKey,
      },
    };
  }

  if (!values.accountId) return { success: false, message: 'Selecione uma conta bancária.' };
  if (!values.categoryId) return { success: false, message: 'Selecione uma categoria.' };

  return {
    success: true,
    input: {
      type: values.type,
      amount,
      description,
      accountId: values.accountId,
      categoryId: values.categoryId,
      competenceDate: optionalDate(values.competenceDate),
      dueDate: optionalDate(values.dueDate),
      paidAt: optionalDate(values.paidAt),
      idempotencyKey,
    },
  };
}

export function acquireSubmissionLock(lock: { current: boolean }): boolean {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

export function releaseSubmissionLock(lock: { current: boolean }): void {
  lock.current = false;
}

export async function submitFinanceTransaction(params: {
  values: CreateTransactionFormValues;
  idempotencyKey: string;
  lock: { current: boolean };
  create: (input: CreateFinanceTransactionInput) => Promise<FinanceMutationResult>;
}): Promise<CreateTransactionSubmissionResult> {
  if (!acquireSubmissionLock(params.lock)) return { kind: 'ignored' };
  try {
    const validation = buildCreateFinanceTransactionInput(params.values, params.idempotencyKey);
    if (!validation.success) return { kind: 'validation_error', message: validation.message };
    const result = await params.create(validation.input);
    return { kind: 'success', message: result.message };
  } catch (cause) {
    return {
      kind: 'error',
      message: cause instanceof Error ? cause.message : 'Não foi possível concluir a operação financeira.',
    };
  } finally {
    releaseSubmissionLock(params.lock);
  }
}

function parseCurrencyInput(value: string): number | undefined {
  const normalized = value.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  if (!normalized) return undefined;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return undefined;
  return Math.round(amount * 100) / 100;
}

function optionalDate(value: string): string | undefined {
  return value ? `${value}T12:00:00.000Z` : undefined;
}
