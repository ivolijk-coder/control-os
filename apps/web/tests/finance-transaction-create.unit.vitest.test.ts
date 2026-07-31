import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionCreateForm, compatibleFinanceCategories } from '@/components/finance/transaction-create-form';
import {
  acquireSubmissionLock,
  buildCreateFinanceTransactionInput,
  emptyCreateTransactionForm,
  releaseSubmissionLock,
  submitFinanceTransaction,
} from '@/lib/finance/transaction-create-model';

const hookState = vi.hoisted(() => ({
  accounts: {} as Record<string, unknown>,
  categories: {} as Record<string, unknown>,
  mutation: {} as Record<string, unknown>,
}));

vi.mock('@/lib/finance', () => ({
  useFinanceAccounts: () => hookState.accounts,
  useFinanceCategories: () => hookState.categories,
  useCreateFinanceTransaction: () => hookState.mutation,
}));

function renderForm(): string {
  return renderToStaticMarkup(React.createElement(TransactionCreateForm));
}

beforeEach(() => {
  hookState.accounts = {
    isPending: false,
    isError: false,
    data: [{ id: 'account-1', name: 'Nubank', status: 'ativa' }],
  };
  hookState.categories = {
    isPending: false,
    isError: false,
    data: [
      { id: 'expense-1', name: 'Alimentação', kind: 'despesa', status: 'ativa' },
      { id: 'income-1', name: 'Salário', kind: 'receita', status: 'ativa' },
    ],
  };
  hookState.mutation = { isPending: false, mutateAsync: vi.fn() };
});

describe('cadastro real de transações', () => {
  it('monta receita e despesa válidas usando valores em reais e datas do contrato', () => {
    const result = buildCreateFinanceTransactionInput({
      ...emptyCreateTransactionForm(),
      type: 'despesa',
      accountId: 'account-1',
      categoryId: 'expense-1',
      description: ' Mercado da semana ',
      amount: '1.234,56',
      competenceDate: '2030-01-10',
      dueDate: '2030-01-15',
      paidAt: '2030-01-10',
    }, 'idempotency-1');

    expect(result).toEqual({
      success: true,
      input: {
        type: 'despesa',
        amount: 1234.56,
        description: 'Mercado da semana',
        accountId: 'account-1',
        categoryId: 'expense-1',
        competenceDate: '2030-01-10T12:00:00.000Z',
        dueDate: '2030-01-15T12:00:00.000Z',
        paidAt: '2030-01-10T12:00:00.000Z',
        idempotencyKey: 'idempotency-1',
      },
    });
  });

  it('valida somente obrigatórios e formatos antes de chamar o domínio', () => {
    expect(buildCreateFinanceTransactionInput(emptyCreateTransactionForm(), 'key')).toEqual({
      success: false,
      message: 'Informe um valor válido maior que zero.',
    });
    expect(buildCreateFinanceTransactionInput({
      ...emptyCreateTransactionForm(), amount: '10', description: 'Despesa',
    }, 'key')).toEqual({ success: false, message: 'Selecione uma conta bancária.' });
  });

  it('usa o contrato atômico de transferência sem categoria paralela', () => {
    const result = buildCreateFinanceTransactionInput({
      ...emptyCreateTransactionForm(),
      type: 'transferencia',
      fromAccountId: 'account-1',
      toAccountId: 'account-2',
      description: 'Reserva',
      amount: '300,00',
    }, 'transfer-key');
    expect(result).toEqual({
      success: true,
      input: {
        type: 'transferencia',
        amount: 300,
        description: 'Reserva',
        fromAccountId: 'account-1',
        toAccountId: 'account-2',
        competenceDate: undefined,
        dueDate: undefined,
        paidAt: undefined,
        idempotencyKey: 'transfer-key',
      },
    });
  });

  it('impede aquisição duplicada do lock até a conclusão do envio', () => {
    const lock = { current: false };
    expect(acquireSubmissionLock(lock)).toBe(true);
    expect(acquireSubmissionLock(lock)).toBe(false);
    releaseSubmissionLock(lock);
    expect(acquireSubmissionLock(lock)).toBe(true);
  });

  it('preserva mensagem real, libera o lock e sinaliza limpeza após sucesso', async () => {
    const lock = { current: false };
    const create = vi.fn(async () => ({ success: true as const, message: 'Despesa registrada.' }));
    const values = {
      ...emptyCreateTransactionForm(),
      accountId: 'account-1', categoryId: 'expense-1', description: 'Mercado', amount: '300',
    };
    await expect(submitFinanceTransaction({ values, idempotencyKey: 'key', lock, create })).resolves.toEqual({
      kind: 'success', message: 'Despesa registrada.',
    });
    expect(create).toHaveBeenCalledOnce();
    expect(lock.current).toBe(false);
  });

  it('preserva erro retornado pela camada financeira e mantém o retry possível', async () => {
    const lock = { current: false };
    const create = vi.fn(async () => { throw new Error('Selecione uma categoria ativa compatível com a transação.'); });
    const values = {
      ...emptyCreateTransactionForm(),
      accountId: 'account-1', categoryId: 'expense-1', description: 'Mercado', amount: '300',
    };
    await expect(submitFinanceTransaction({ values, idempotencyKey: 'same-key', lock, create })).resolves.toEqual({
      kind: 'error', message: 'Selecione uma categoria ativa compatível com a transação.',
    });
    expect(lock.current).toBe(false);
  });

  it('renderiza loading, erro real e formulário com os hooks oficiais', () => {
    hookState.accounts = { isPending: true, isError: false, data: undefined };
    expect(renderForm()).toContain('Carregando formulário de transação');

    hookState.accounts = { isPending: false, isError: true, error: new Error('Contas indisponíveis.') };
    expect(renderForm()).toContain('Contas indisponíveis.');

    hookState.accounts = { isPending: false, isError: false, data: [{ id: 'account-1', name: 'Nubank' }] };
    const html = renderForm();
    expect(html).toContain('Despesa');
    expect(html).toContain('Receita');
    expect(html).toContain('Transferência');
    expect(html).toContain('Nubank');
    expect(html).toContain('Alimentação');
    expect(html).toContain('Registrar transação');
  });

  it('desabilita o formulário e o envio durante a mutação', () => {
    hookState.mutation = { isPending: true, mutateAsync: vi.fn() };
    const html = renderForm();
    expect(html).toContain('<fieldset disabled=""');
    expect(html).toContain('Registrando…');
  });

  it('filtra categorias reais compatíveis e o reset volta ao estado inicial', () => {
    const categories = hookState.categories.data as Parameters<typeof compatibleFinanceCategories>[0];
    expect(compatibleFinanceCategories(categories, 'despesa').map((item) => item.name)).toEqual(['Alimentação']);
    expect(compatibleFinanceCategories(categories, 'receita').map((item) => item.name)).toEqual(['Salário']);
    expect(compatibleFinanceCategories(categories, 'transferencia')).toEqual([]);
    expect(emptyCreateTransactionForm()).toEqual({
      type: 'despesa', accountId: '', fromAccountId: '', toAccountId: '', categoryId: '',
      description: '', amount: '', competenceDate: '', dueDate: '', paidAt: '',
    });
  });
});
