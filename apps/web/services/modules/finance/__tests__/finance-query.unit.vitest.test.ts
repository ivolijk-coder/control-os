import { describe, expect, it } from 'vitest';
import type { FinanceTransactionFilters } from '@control-os/types';
import { InMemoryFinanceRepository } from '@/services/repositories/finance/in-memory-finance.repository';
import { PersistentFinanceService } from '../finance.service';
import {
  DEFAULT_FINANCE_TRANSACTION_PAGE_SIZE,
  FinanceQueryError,
  MAX_FINANCE_TRANSACTION_PAGE_SIZE,
  normalizeFinanceTransactionFilters,
} from '../finance-query';

function setup(userId = 'query-user') {
  const repository = new InMemoryFinanceRepository();
  const account = repository.seedAccountForTest(userId, 'Conta principal');
  const service = new PersistentFinanceService(repository, userId);
  return { account, repository, service };
}

function untrustedFilters(value: Record<string, unknown>): FinanceTransactionFilters {
  return value as unknown as FinanceTransactionFilters;
}

async function categoryId(service: PersistentFinanceService, name: string, kind: 'receita' | 'despesa'): Promise<string> {
  const result = await service.createCategory({ name, kind });
  return (result.data as { id: string }).id;
}

describe('contratos da consulta financeira', () => {
  it('normaliza o limite padrão e aceita o máximo', () => {
    expect(normalizeFinanceTransactionFilters().limit).toBe(DEFAULT_FINANCE_TRANSACTION_PAGE_SIZE);
    expect(normalizeFinanceTransactionFilters({ limit: MAX_FINANCE_TRANSACTION_PAGE_SIZE }).limit).toBe(MAX_FINANCE_TRANSACTION_PAGE_SIZE);
  });

  it('rejeita limite acima do máximo, enums e ordenação inválidos', () => {
    expect(() => normalizeFinanceTransactionFilters({ limit: 101 })).toThrow(FinanceQueryError);
    expect(() => normalizeFinanceTransactionFilters(untrustedFilters({ type: 'invalido' }))).toThrow('Tipo de transação inválido');
    expect(() => normalizeFinanceTransactionFilters(untrustedFilters({ status: 'invalido' }))).toThrow('Status de transação inválido');
    expect(() => normalizeFinanceTransactionFilters(untrustedFilters({ origin: 'invalida' }))).toThrow('Origem de transação inválida');
    expect(() => normalizeFinanceTransactionFilters(untrustedFilters({ sort: 'amount_desc' }))).toThrow('Ordenação inválida');
  });

  it('valida datas, intervalos inclusivos e tamanho da busca', () => {
    const normalized = normalizeFinanceTransactionFilters({
      competenceFrom: '2030-01-01',
      competenceTo: '2030-01-31',
      dueDateFrom: '2030-02-01',
      dueDateTo: '2030-02-28',
    });
    expect(normalized.competenceFrom).toBe('2030-01-01T00:00:00.000Z');
    expect(normalized.competenceTo).toBe('2030-01-31T23:59:59.999Z');
    expect(() => normalizeFinanceTransactionFilters({ competenceFrom: '2030-02-01', competenceTo: '2030-01-01' })).toThrow('intervalo de competência');
    expect(() => normalizeFinanceTransactionFilters({ dueDateFrom: '2030-02-30' })).toThrow('Vencimento inicial inválida');
    expect(() => normalizeFinanceTransactionFilters({ search: 'x'.repeat(121) })).toThrow('no máximo 120');
  });

  it('rejeita cursor malformado', async () => {
    const { service } = setup();
    await expect(service.listTransactionsPaginated({ cursor: 'nao-e-um-cursor' })).rejects.toMatchObject({ code: 'invalid_cursor' });
  });
});

describe('consulta paginada de transações', () => {
  it('pagina no repositório, cria nextCursor e não duplica registros', async () => {
    const { account, service } = setup();
    const category = await categoryId(service, 'Mercado', 'despesa');
    for (let index = 1; index <= 5; index += 1) {
      await service.createTransaction({
        type: 'despesa',
        amount: index,
        description: `Compra ${index}`,
        categoryId: category,
        accountId: account.id,
        competenceDate: '2030-01-10T12:00:00.000Z',
      });
    }
    const first = await service.listTransactionsPaginated({ limit: 2 });
    const second = await service.listTransactionsPaginated({ limit: 2, cursor: first.nextCursor ?? undefined });
    const third = await service.listTransactionsPaginated({ limit: 2, cursor: second.nextCursor ?? undefined });
    expect(first.hasMore).toBe(true);
    expect(second.hasMore).toBe(true);
    expect(third.hasMore).toBe(false);
    expect(new Set([...first.items, ...second.items, ...third.items].map((item) => item.id)).size).toBe(5);
  });

  it('combina tipo, status, conta, categoria, origem, datas e busca textual', async () => {
    const { account, repository, service } = setup();
    const otherAccount = repository.seedAccountForTest('query-user', 'Reserva');
    const mercado = await categoryId(service, 'Mercado', 'despesa');
    const lazer = await categoryId(service, 'Lazer', 'despesa');
    await service.createTransaction({
      type: 'despesa', amount: 75.25, description: 'Supermercado central', categoryId: mercado,
      accountId: account.id, status: 'pendente', source: 'nova',
      competenceDate: '2030-03-15T12:00:00.000Z', dueDate: '2030-03-20T12:00:00.000Z',
    });
    await service.createTransaction({
      type: 'despesa', amount: 30, description: 'Cinema', categoryId: lazer,
      accountId: otherAccount.id, status: 'confirmada', source: 'manual',
      competenceDate: '2030-03-15T12:00:00.000Z', dueDate: '2030-03-20T12:00:00.000Z',
    });
    const page = await service.listTransactionsPaginated({
      type: 'despesa',
      status: 'pendente',
      accountId: account.id,
      categoryId: mercado,
      origin: 'nova',
      competenceFrom: '2030-03-01',
      competenceTo: '2030-03-31',
      dueDateFrom: '2030-03-20',
      dueDateTo: '2030-03-20',
      search: 'MERCADO CENTRAL',
      sort: 'date_asc',
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ description: 'Supermercado central', amount: 75.25, source: 'nova' });
    expect(typeof page.items[0]?.amount).toBe('number');
  });

  it('lê detalhe somente no escopo do proprietário e oculta outro usuário', async () => {
    const repository = new InMemoryFinanceRepository();
    const ownerAccount = repository.seedAccountForTest('owner');
    repository.seedAccountForTest('other');
    const owner = new PersistentFinanceService(repository, 'owner');
    const other = new PersistentFinanceService(repository, 'other');
    const category = await categoryId(owner, 'Privada', 'despesa');
    const created = await owner.createTransaction({
      type: 'despesa', amount: 10, description: 'Somente proprietário',
      categoryId: category, accountId: ownerAccount.id,
    });
    const id = (created.data as { id: string }).id;
    await expect(owner.getTransactionById(id)).resolves.toMatchObject({ id, description: 'Somente proprietário' });
    await expect(other.getTransactionById(id)).rejects.toMatchObject({ code: 'not_found' });
    await expect(other.getTransactionById('inexistente')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('rejeita cursor pertencente a outro usuário', async () => {
    const repository = new InMemoryFinanceRepository();
    const ownerAccount = repository.seedAccountForTest('cursor-owner');
    repository.seedAccountForTest('cursor-other');
    const owner = new PersistentFinanceService(repository, 'cursor-owner');
    const other = new PersistentFinanceService(repository, 'cursor-other');
    const category = await categoryId(owner, 'Cursor', 'despesa');
    for (let index = 0; index < 2; index += 1) {
      await owner.createTransaction({ type: 'despesa', amount: 10 + index, categoryId: category, accountId: ownerAccount.id });
    }
    const ownerPage = await owner.listTransactionsPaginated({ limit: 1 });
    await expect(other.listTransactionsPaginated({ limit: 1, cursor: ownerPage.nextCursor ?? undefined })).rejects.toMatchObject({ code: 'invalid_cursor' });
  });

  it('preserva criação, idempotência, confirmação, cancelamento, estorno e transferência', async () => {
    const { account, repository, service } = setup('regression-user');
    const destination = repository.seedAccountForTest('regression-user', 'Destino');
    const expenseCategory = await categoryId(service, 'Regressão despesa', 'despesa');
    const incomeCategory = await categoryId(service, 'Regressão receita', 'receita');
    const pending = await service.createTransaction({
      type: 'despesa', amount: 40, description: 'Pendente', categoryId: expenseCategory,
      accountId: account.id, status: 'pendente', idempotencyKey: 'regression-key',
    });
    const pendingId = (pending.data as { id: string }).id;
    const retry = await service.createTransaction({
      type: 'despesa', amount: 40, description: 'Pendente', categoryId: expenseCategory,
      accountId: account.id, status: 'pendente', idempotencyKey: 'regression-key',
    });
    expect((retry.data as { id: string }).id).toBe(pendingId);
    await expect(service.confirmTransaction(pendingId)).resolves.toMatchObject({ success: true });

    const cancellable = await service.createTransaction({
      type: 'receita', amount: 20, description: 'Cancelar', categoryId: incomeCategory,
      accountId: account.id, status: 'pendente',
    });
    await expect(service.cancelTransaction((cancellable.data as { id: string }).id)).resolves.toMatchObject({ success: true });
    await expect(service.reverseTransaction(pendingId)).resolves.toMatchObject({ success: true });
    await expect(service.createTransfer({
      fromAccountName: account.name,
      toAccountName: destination.name,
      amount: 10,
    })).resolves.toMatchObject({ success: true });
  });
});
