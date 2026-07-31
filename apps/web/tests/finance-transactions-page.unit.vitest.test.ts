import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FinanceTransactionDto } from '@control-os/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FinanceTransactionsPage from '@/app/(dashboard)/financeiro/transacoes/page';
import { TransactionDetailContent } from '@/components/finance/transaction-detail-content';
import {
  buildFinanceTransactionFilters,
  INITIAL_TRANSACTION_FILTERS,
} from '@/lib/finance/transaction-list-model';

const queryState = vi.hoisted(() => ({
  transactions: {} as Record<string, unknown>,
  transaction: {} as Record<string, unknown>,
  accounts: {} as Record<string, unknown>,
  categories: {} as Record<string, unknown>,
}));

vi.mock('@/lib/finance', () => ({
  useFinanceTransactions: () => queryState.transactions,
  useFinanceTransaction: () => queryState.transaction,
  useFinanceAccounts: () => queryState.accounts,
  useFinanceCategories: () => queryState.categories,
}));

function transaction(overrides: Partial<FinanceTransactionDto> = {}): FinanceTransactionDto {
  return {
    id: 'transaction-1',
    type: 'despesa',
    description: 'Mercado',
    amount: 470,
    category: 'Alimentação',
    categoryId: 'category-1',
    accountId: 'account-1',
    date: '2030-01-10T12:00:00.000Z',
    competenceDate: '2030-01-10T12:00:00.000Z',
    confirmedAt: '2030-01-10T13:00:00.000Z',
    status: 'confirmada',
    source: 'manual',
    ...overrides,
  };
}

function renderPage(): string {
  return renderToStaticMarkup(React.createElement(FinanceTransactionsPage));
}

beforeEach(() => {
  queryState.transactions = {
    isPending: false,
    isError: false,
    data: { items: [], nextCursor: null, hasMore: false },
  };
  queryState.transaction = { isPending: false, isError: false, data: undefined };
  queryState.accounts = {
    isPending: false,
    isError: false,
    data: [{ id: 'account-1', name: 'Conta principal', balance: 0, kind: 'conta_corrente', currency: 'BRL', status: 'ativa' }],
  };
  queryState.categories = {
    isPending: false,
    isError: false,
    data: [{ id: 'category-1', name: 'Alimentação' }],
  };
});

describe('lista real de transações', () => {
  it('renderiza Skeleton durante o carregamento', () => {
    queryState.transactions = { isPending: true, isError: false, data: undefined };
    const html = renderPage();
    expect(html).toContain('Carregando transações');
    expect(html).toContain('animate-shimmer');
  });

  it('renderiza o componente padrão de erro', () => {
    queryState.transactions = {
      isPending: false,
      isError: true,
      error: new Error('Transações indisponíveis.'),
    };
    const html = renderPage();
    expect(html).toContain('role="alert"');
    expect(html).toContain('Transações indisponíveis.');
  });

  it('renderiza EmptyState sem dados demonstrativos', () => {
    const html = renderPage();
    expect(html).toContain('Nenhuma transação encontrada.');
    expect(html).not.toContain('Mercado');
  });

  it('renderiza resposta válida e prepara a abertura do detalhe', () => {
    queryState.transactions = {
      isPending: false,
      isError: false,
      data: { items: [transaction()], nextCursor: 'opaque-next-page', hasMore: true },
    };
    const html = renderPage();
    expect(html).toContain('Mercado');
    expect(html).toContain('Alimentação');
    expect(html).toContain('Confirmada');
    expect(html).toContain('470');
    expect(html).toContain('aria-label="Abrir detalhes de Mercado"');
    expect(html).toContain('Paginação segura por cursor');
    expect(html).toContain('Próxima');
  });

  it('oferece filtros, pesquisa e somente a ordenação suportada pela API', () => {
    const html = renderPage();
    expect(html).toContain('Buscar por descrição ou categoria');
    expect(html).toContain('Todas as contas');
    expect(html).toContain('Todas as categorias');
    expect(html).toContain('Todos os tipos');
    expect(html).toContain('Todos os status');
    expect(html).toContain('Competência inicial');
    expect(html).toContain('Competência final');
    expect(html).toContain('Mais recentes');
    expect(html).toContain('Mais antigas');
  });

  it('monta filtros remotos completos, busca e cursor sem filtrar arrays locais', () => {
    expect(buildFinanceTransactionFilters({
      ...INITIAL_TRANSACTION_FILTERS,
      search: 'ignorado até o debounce',
      competenceFrom: '2030-01-01',
      competenceTo: '2030-01-31',
      accountId: 'account-1',
      categoryId: 'category-1',
      type: 'despesa',
      status: 'confirmada',
      sort: 'date_asc',
    }, ' mercado ', 'opaque-cursor')).toEqual({
      cursor: 'opaque-cursor',
      limit: 20,
      type: 'despesa',
      status: 'confirmada',
      accountId: 'account-1',
      categoryId: 'category-1',
      competenceFrom: '2030-01-01',
      competenceTo: '2030-01-31',
      search: 'mercado',
      sort: 'date_asc',
    });
  });

  it('renderiza o detalhe com conta, competência, confirmação, histórico e anexos', () => {
    const html = renderToStaticMarkup(
      React.createElement(TransactionDetailContent, {
        transaction: transaction(),
        accountName: 'Conta principal',
      })
    );
    expect(html).toContain('Mercado');
    expect(html).toContain('Conta principal');
    expect(html).toContain('Competência');
    expect(html).toContain('Confirmação');
    expect(html).toContain('Histórico disponível');
    expect(html).toContain('Nenhum anexo disponível no contrato de consulta atual.');
  });
});
