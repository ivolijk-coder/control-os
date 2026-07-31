import { describe, expect, it, vi } from 'vitest';
import { CreateExpenseAction } from '@/services/action-engine/actions/finance/create-expense.action';
import { InMemoryFinanceRepository } from '@/services/repositories/finance/in-memory-finance.repository';
import { PersistentFinanceService } from '../finance.service';

function setup(userId = 'category-owner') {
  const repository = new InMemoryFinanceRepository();
  const account = repository.seedAccountForTest(userId, 'Conta principal');
  const service = new PersistentFinanceService(repository, userId);
  return { account, repository, service, userId };
}

describe('resolução segura de categorias padrão', () => {
  it('materializa uma categoria padrão de receita usando o identificador lógico em minúsculas', async () => {
    const { account, repository, service, userId } = setup();
    const findById = vi.spyOn(repository, 'findCategoryById');
    const result = await service.createTransaction({
      type: 'receita',
      amount: 100,
      description: 'Freelance',
      categoryId: 'default:freelance',
      accountId: account.id,
    });

    expect(result.success).toBe(true);
    const [persisted] = await repository.listCategories(userId, { includeArchived: true });
    expect(persisted).toMatchObject({ name: 'Freelance', kind: 'receita', status: 'ativa' });
    expect((result.data as { categoryId: string }).categoryId).toBe(persisted?.id);
    expect(findById).not.toHaveBeenCalled();
  });

  it('materializa uma categoria padrão de despesa e nunca persiste default:* como FK', async () => {
    const { account, repository, service, userId } = setup();
    const result = await service.createTransaction({
      type: 'despesa',
      amount: 30,
      description: 'Almoço',
      categoryId: 'default:alimentação',
      accountId: account.id,
    });

    expect(result.success).toBe(true);
    const [entry] = await service.listTransactions();
    const [persisted] = await repository.listCategories(userId, { includeArchived: true });
    expect(entry?.categoryId).toBe(persisted?.id);
    expect(entry?.categoryId).not.toContain('default:');
  });

  it('preserva categoria personalizada ativa selecionada por ID', async () => {
    const { account, service } = setup();
    const custom = await service.createCategory({ name: 'Pet', kind: 'despesa' });
    const categoryId = (custom.data as { id: string }).id;
    const result = await service.createTransaction({
      type: 'despesa', amount: 45, description: 'Veterinário', categoryId, accountId: account.id,
    });

    expect(result.success).toBe(true);
    expect((result.data as { categoryId: string }).categoryId).toBe(categoryId);
  });

  it('não aceita categoria pertencente a outro usuário', async () => {
    const repository = new InMemoryFinanceRepository();
    const ownerAccount = repository.seedAccountForTest('owner', 'Conta do proprietário');
    const otherAccount = repository.seedAccountForTest('other', 'Conta de outro usuário');
    const owner = new PersistentFinanceService(repository, 'owner');
    const other = new PersistentFinanceService(repository, 'other');
    const custom = await owner.createCategory({ name: 'Privada', kind: 'despesa' });
    const categoryId = (custom.data as { id: string }).id;

    const result = await other.createTransaction({
      type: 'despesa', amount: 10, description: 'Tentativa', categoryId, accountId: otherAccount.id,
    });

    expect(result.success).toBe(false);
    expect(await repository.list('other')).toHaveLength(0);
    expect(await repository.list('owner')).toHaveLength(0);
    expect(ownerAccount.id).not.toBe(otherAccount.id);
  });

  it('rejeita categoria arquivada sem recriar o mesmo padrão', async () => {
    const { account, repository, service, userId } = setup();
    const materialized = await service.createCategory({ name: 'Mercado', kind: 'despesa' });
    const categoryId = (materialized.data as { id: string }).id;
    await service.archiveCategory(categoryId);

    const result = await service.createTransaction({
      type: 'despesa', amount: 20, description: 'Compra', categoryId: 'default:mercado', accountId: account.id,
    });

    expect(result.success).toBe(false);
    const persisted = await repository.listCategories(userId, { includeArchived: true });
    expect(persisted.filter((category) => category.name === 'Mercado')).toHaveLength(1);
    expect(persisted[0]?.status).toBe('arquivada');
  });

  it('rejeita identificador padrão inexistente sem criar fallback', async () => {
    const { account, repository, service, userId } = setup();
    const result = await service.createTransaction({
      type: 'receita', amount: 50, description: 'Inválida', categoryId: 'default:inexistente', accountId: account.id,
    });

    expect(result.success).toBe(false);
    expect(await repository.listCategories(userId, { includeArchived: true })).toHaveLength(0);
  });

  it('reutiliza a categoria materializada sem duplicidade', async () => {
    const { account, repository, service, userId } = setup();
    for (const description of ['Projeto A', 'Projeto B']) {
      const result = await service.createTransaction({
        type: 'receita', amount: 80, description, categoryId: 'default:freelance', accountId: account.id,
      });
      expect(result.success).toBe(true);
    }

    const persisted = await repository.listCategories(userId, { includeArchived: true });
    expect(persisted.filter((category) => category.name === 'Freelance')).toHaveLength(1);
    const entries = await service.listTransactions();
    expect(new Set(entries.map((entry) => entry.categoryId))).toEqual(new Set([persisted[0]?.id]));
  });

  it('mantém a NOVA no mesmo FinanceService e resolve seu padrão para UUID persistido', async () => {
    const { repository, service, userId } = setup();
    const action = new CreateExpenseAction(service);
    const result = await action.execute({
      value: 25,
      description: 'Almoço',
      source: 'nova',
    });

    expect(result.success).toBe(true);
    const [entry] = await service.listTransactions();
    const [category] = await repository.listCategories(userId, { includeArchived: true });
    expect(category?.name).toBe('Alimentação');
    expect(entry).toMatchObject({ categoryId: category?.id, source: 'nova' });
  });

  it('cria pendências com categoria real e preserva confirmação e cancelamento', async () => {
    const { account, repository, service, userId } = setup();
    const toConfirm = await service.createTransaction({
      type: 'receita', amount: 120, description: 'Confirmar', categoryId: 'default:salário', accountId: account.id, status: 'pendente',
    });
    const toCancel = await service.createTransaction({
      type: 'despesa', amount: 15, description: 'Cancelar', categoryId: 'default:alimentação', accountId: account.id, status: 'pendente',
    });

    expect(toConfirm.success).toBe(true);
    expect(toCancel.success).toBe(true);
    expect(await service.confirmTransaction((toConfirm.data as { id: string }).id)).toMatchObject({ success: true });
    expect(await service.cancelTransaction((toCancel.data as { id: string }).id)).toMatchObject({ success: true });
    const entries = await service.listTransactions();
    expect(entries.find((entry) => entry.description === 'Confirmar')?.status).toBe('confirmada');
    expect(entries.find((entry) => entry.description === 'Cancelar')?.status).toBe('cancelada');
    expect(await repository.listCategories(userId, { includeArchived: true })).toHaveLength(2);
  });
});
