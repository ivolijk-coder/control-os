'use client';

import * as React from 'react';
import { ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import type { FinanceCategory } from '@control-os/types';
import { Button, Input, Label } from '@control-os/ui';
import { FormError } from '@/components/ui/form-error';
import { GlassCard } from '@/components/ui/glass-card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCreateFinanceTransaction,
  useFinanceAccounts,
  useFinanceCategories,
} from '@/lib/finance';
import {
  emptyCreateTransactionForm,
  submitFinanceTransaction,
  type CreateTransactionFormValues,
  type CreateTransactionType,
} from '@/lib/finance/transaction-create-model';

const SELECT_CLASS = 'mt-1.5 h-11 w-full rounded-md border border-tint/10 bg-surface-0 px-3 text-sm text-text-primary outline-none focus:border-accent-purple/40 focus:shadow-glow-purple disabled:cursor-not-allowed disabled:opacity-40';

export function TransactionCreateForm() {
  const accountsQuery = useFinanceAccounts();
  const categoriesQuery = useFinanceCategories();
  const createTransaction = useCreateFinanceTransaction();
  const [values, setValues] = React.useState<CreateTransactionFormValues>(emptyCreateTransactionForm);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const submissionLock = React.useRef(false);
  const idempotencyKey = React.useRef<string>();

  const accounts = accountsQuery.data ?? [];
  const compatibleCategories = compatibleFinanceCategories(categoriesQuery.data ?? [], values.type);
  const loadingOptions = accountsQuery.isPending || categoriesQuery.isPending;
  const optionsError = accountsQuery.isError
    ? accountsQuery.error.message
    : categoriesQuery.isError
      ? categoriesQuery.error.message
      : null;

  function update<K extends keyof CreateTransactionFormValues>(key: K, value: CreateTransactionFormValues[K]): void {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError(null);
    setSuccessMessage(null);
  }

  function changeType(type: CreateTransactionType): void {
    setValues((current) => ({ ...current, type, categoryId: '' }));
    setFormError(null);
    setSuccessMessage(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (createTransaction.isPending) return;

    setFormError(null);
    setSuccessMessage(null);
    idempotencyKey.current ??= crypto.randomUUID();
    const result = await submitFinanceTransaction({
      values,
      idempotencyKey: idempotencyKey.current,
      lock: submissionLock,
      create: (input) => createTransaction.mutateAsync(input),
    });
    if (result.kind === 'success') {
      setSuccessMessage(result.message);
      setValues(emptyCreateTransactionForm());
      idempotencyKey.current = undefined;
    } else if (result.kind === 'validation_error' || result.kind === 'error') {
      setFormError(result.message);
    }
  }

  if (loadingOptions) {
    return (
      <GlassCard interactive={false} className="space-y-4 p-6" aria-label="Carregando formulário de transação">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-28 w-full" />
      </GlassCard>
    );
  }

  if (optionsError) return <FormError message={optionsError} />;

  return (
    <GlassCard interactive={false} className="p-6">
      <form className="space-y-6" onSubmit={(event) => void submit(event)} noValidate>
        <fieldset disabled={createTransaction.isPending} className="space-y-6">
          <div className="grid grid-cols-3 gap-2" aria-label="Tipo da transação">
            {([
              ['despesa', 'Despesa'],
              ['receita', 'Receita'],
              ['transferencia', 'Transferência'],
            ] as const).map(([type, label]) => (
              <button
                key={type}
                type="button"
                onClick={() => changeType(type)}
                aria-pressed={values.type === type}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${values.type === type ? 'border-accent-blue/50 bg-accent-blue/10 text-accent-blue' : 'border-border-subtle bg-tint/[0.025] text-text-secondary hover:bg-tint/[0.05]'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {values.type === 'transferencia' ? (
            <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
              <SelectField
                label="Conta de origem"
                value={values.fromAccountId}
                onChange={(value) => update('fromAccountId', value)}
                options={accounts.map((account) => [account.id, account.name])}
                placeholder="Selecione a origem"
              />
              <ArrowLeftRight className="mx-auto mb-3 hidden h-4 w-4 text-text-tertiary sm:block" />
              <SelectField
                label="Conta de destino"
                value={values.toAccountId}
                onChange={(value) => update('toAccountId', value)}
                options={accounts.map((account) => [account.id, account.name])}
                placeholder="Selecione o destino"
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Conta bancária"
                value={values.accountId}
                onChange={(value) => update('accountId', value)}
                options={accounts.map((account) => [account.id, account.name])}
                placeholder="Selecione uma conta"
              />
              <SelectField
                label="Categoria"
                value={values.categoryId}
                onChange={(value) => update('categoryId', value)}
                options={compatibleCategories.map((category) => [category.id, category.name])}
                placeholder="Selecione uma categoria"
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div>
              <Label htmlFor="transaction-description">Descrição</Label>
              <Input
                id="transaction-description"
                value={values.description}
                onChange={(event) => update('description', event.target.value)}
                maxLength={160}
                placeholder={values.type === 'transferencia' ? 'Ex.: Reserva mensal' : 'Ex.: Mercado da semana'}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="transaction-amount">Valor</Label>
              <Input
                id="transaction-amount"
                inputMode="decimal"
                value={values.amount}
                onChange={(event) => update('amount', event.target.value)}
                placeholder="0,00"
                className="mt-1.5 font-mono"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <DateField label="Competência (opcional)" value={values.competenceDate} onChange={(value) => update('competenceDate', value)} />
            <DateField label="Vencimento (opcional)" value={values.dueDate} onChange={(value) => update('dueDate', value)} />
            <DateField label="Pagamento (opcional)" value={values.paidAt} onChange={(value) => update('paidAt', value)} />
          </div>
        </fieldset>

        <FormError message={formError} />
        {successMessage && (
          <div role="status" className="flex items-center gap-2 rounded-md border border-accent-green/20 bg-accent-green/10 px-3 py-2 text-xs text-accent-green">
            <CheckCircle2 className="h-4 w-4" />
            {successMessage}
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" loading={createTransaction.isPending} disabled={createTransaction.isPending || accounts.length === 0}>
            {createTransaction.isPending ? 'Registrando…' : 'Registrar transação'}
          </Button>
        </div>
      </form>
    </GlassCard>
  );
}

export function compatibleFinanceCategories(categories: FinanceCategory[], type: CreateTransactionType): FinanceCategory[] {
  if (type === 'transferencia') return [];
  return categories.filter((category) => category.status === 'ativa' && category.kind === type);
}

function SelectField({ label, value, options, placeholder, onChange }: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <Label className="block">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className={SELECT_CLASS}>
        <option value="">{placeholder}</option>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </Label>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Label className="block">
      {label}
      <Input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5" />
    </Label>
  );
}
