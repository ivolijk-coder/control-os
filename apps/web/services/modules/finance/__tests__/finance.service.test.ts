/**
 * Testes de `PersistentFinanceService` (CONTROL OS — Fase 6: Persistência
 * real). Mesmo harness mínimo das Fases 4/5 (`test`/`assert`, sem
 * Jest/Vitest — nenhum dos dois instalado, sandbox sem acesso ao registry
 * npm). Ver `services/control-hub/__tests__/action-engine.integration.test.ts`
 * para o precedente deste padrão.
 *
 * IMPORTANTE — por que este teste usa `InMemoryFinanceRepository`, não o
 * `financeRepository` de produção (`PrismaFinanceRepository`): esta sandbox
 * não tem acesso a um Postgres real nem ao registry npm pra instalar
 * `@prisma/client` (ver relatório da Fase 6). "Usar uma base de dados de
 * teste ou implementação de teste adequada" (pedido original) — esta é
 * essa implementação: `InMemoryFinanceRepository` (mesmo diretório de
 * `PrismaFinanceRepository`, implementa a MESMA interface
 * `FinanceRepository`) valida toda a lógica de negócio de
 * `PersistentFinanceService` (guards de tipo, cálculo de saldo, filtros de
 * mês) de ponta a ponta, sem mock nenhum de rede.
 *
 * Import direto de `../finance.service` (não do barrel
 * `@/services/modules`) e de `.../in-memory-finance.repository` (não do
 * barrel `@/services/repositories`) de propósito: os dois barrels
 * instanciam o singleton de produção (`PrismaFinanceRepository`), que
 * importa `@prisma/client` — pacote não instalável nesta sandbox. Importar
 * os arquivos de origem direto evita essa cadeia inteira; em produção
 * (máquina do usuário, com `pnpm install` rodado), os barrels funcionam
 * normalmente — nada nesta mudança afeta o caminho de produção.
 */
import { PersistentFinanceService } from '../finance.service';
import { InMemoryFinanceRepository } from '@/services/repositories/finance/in-memory-finance.repository';

let passed = 0;
let failed = 0;

function assert(condition: boolean | undefined, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    // eslint-disable-next-line no-console -- script de teste standalone, não roda em produção.
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failed += 1;
    // eslint-disable-next-line no-console -- script de teste standalone, não roda em produção.
    console.log(`  FAIL  ${name}`);
    // eslint-disable-next-line no-console -- script de teste standalone, não roda em produção.
    console.log(`        ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Uma instância nova por bloco de teste — nenhum teste deve depender de estado deixado por outro. */
function buildService(): PersistentFinanceService {
  const repository = new InMemoryFinanceRepository();
  // Os testes legados exercitam receitas/despesas sem se preocupar com a
  // criação da conta. A conta é preparada explicitamente no repositório de
  // teste — nunca pelo serviço em produção.
  repository.seedAccountForTest('usr_test');
  return new PersistentFinanceService(repository, 'usr_test');
}

async function onlyAccountId(service: PersistentFinanceService): Promise<string> {
  const [account] = await service.listAccounts();
  if (!account) throw new Error('o cenário de teste exige uma conta preparada');
  return account.id;
}

async function main(): Promise<void> {
  await test('createExpense — registra despesa e devolve ActionResult de sucesso', async () => {
    const service = buildService();
    const result = await service.createExpense({ amount: 350, description: 'Supermercado', category: 'Mercado' });
    assert(result.success === true, `esperava sucesso, recebeu: ${result.message}`);
    assert(result.message.includes('350'), `mensagem devia mencionar o valor: "${result.message}"`);
  });

  await test('updateExpense — edita uma despesa existente', async () => {
    const service = buildService();
    const created = await service.createTransaction({
      type: 'despesa', amount: 100, description: 'Padaria', categoryId: 'default:Mercado',
      accountId: await onlyAccountId(service), status: 'pendente',
    });
    const id = (created.data as { id: string }).id;
    const updated = await service.updateExpense({ id, amount: 120, description: 'Padaria (ajustado)' });
    assert(updated.success === true, `esperava sucesso, recebeu: ${updated.message}`);
    const [entry] = await service.listExpenses();
    assert(entry?.amount === 120, `esperava valor 120 após update, recebeu ${entry?.amount}`);
    assert(entry?.description === 'Padaria (ajustado)', `esperava descrição atualizada, recebeu "${entry?.description}"`);
  });

  await test('updateExpense — nunca deixa mutar uma receita pelo caminho de despesa', async () => {
    const service = buildService();
    const income = await service.createIncome({ amount: 3000, description: 'Salário', category: 'Trabalho' });
    const id = (income.data as { id: string }).id;
    const result = await service.updateExpense({ id, amount: 1 });
    assert(result.success === false, 'esperava falha ao tentar editar uma receita como se fosse despesa');
  });

  await test('deleteExpense — cancela uma despesa pendente sem apagar histórico', async () => {
    const service = buildService();
    const created = await service.createTransaction({
      type: 'despesa', amount: 50, description: 'Farmácia', categoryId: 'default:Saúde',
      accountId: await onlyAccountId(service), status: 'pendente',
    });
    const id = (created.data as { id: string }).id;
    const deleted = await service.deleteExpense({ id });
    assert(deleted.success === true, `esperava sucesso, recebeu: ${deleted.message}`);
    const remaining = await service.listExpenses();
    assert(remaining.length === 1 && remaining[0]?.status === 'cancelada', 'o cancelamento deve preservar a transação no histórico');
  });

  await test('deleteExpense — devolve erro claro para id inexistente', async () => {
    const service = buildService();
    const result = await service.deleteExpense({ id: 'nao_existe' });
    assert(result.success === false, 'esperava falha ao excluir id inexistente');
  });

  await test('listExpenses — lista só despesas, nunca receitas', async () => {
    const service = buildService();
    await service.createExpense({ amount: 350, description: 'Supermercado', category: 'Mercado' });
    await service.createIncome({ amount: 3000, description: 'Salário', category: 'Trabalho' });
    const expenses = await service.listExpenses();
    assert(expenses.length === 1, `esperava 1 despesa, recebeu ${expenses.length}`);
    assert(expenses[0]?.type === 'despesa', `esperava type "despesa", recebeu "${expenses[0]?.type}"`);
  });

  await test('createIncome — registra receita e devolve ActionResult de sucesso', async () => {
    const service = buildService();
    const result = await service.createIncome({ amount: 3200, description: 'Salário', category: 'Trabalho' });
    assert(result.success === true, `esperava sucesso, recebeu: ${result.message}`);
    assert(result.message.includes('3200'), `mensagem devia mencionar o valor: "${result.message}"`);
  });

  await test('listIncome — lista só receitas, nunca despesas', async () => {
    const service = buildService();
    await service.createExpense({ amount: 350, description: 'Supermercado', category: 'Mercado' });
    await service.createIncome({ amount: 3200, description: 'Salário', category: 'Trabalho' });
    const income = await service.listIncome();
    assert(income.length === 1, `esperava 1 receita, recebeu ${income.length}`);
    assert(income[0]?.type === 'receita', `esperava type "receita", recebeu "${income[0]?.type}"`);
  });

  await test('getBalance — reflete receitas menos despesas depois de cada mutação', async () => {
    const service = buildService();
    assert((await service.getBalance()) === 0, 'saldo inicial devia ser 0');

    await service.createIncome({ amount: 3200, description: 'Salário', category: 'Trabalho' });
    assert((await service.getBalance()) === 3200, `esperava saldo 3200, recebeu ${await service.getBalance()}`);

    const expense = await service.createExpense({ amount: 350, description: 'Supermercado', category: 'Mercado' });
    assert((await service.getBalance()) === 2850, `esperava saldo 2850, recebeu ${await service.getBalance()}`);

    const expenseId = (expense.data as { id: string }).id;
    await service.reverseTransaction(expenseId);
    assert((await service.getBalance()) === 3200, `esperava saldo de volta a 3200 após estornar a despesa, recebeu ${await service.getBalance()}`);
  });

  await test('getSummary — soma receitas, despesas e saldo corretamente', async () => {
    const service = buildService();
    await service.createIncome({ amount: 3200, description: 'Salário', category: 'Trabalho' });
    await service.createIncome({ amount: 500, description: 'Freela', category: 'Trabalho' });
    await service.createExpense({ amount: 350, description: 'Supermercado', category: 'Mercado' });
    await service.createExpense({ amount: 120, description: 'Farmácia', category: 'Saúde' });

    const summary = await service.getSummary();
    assert(summary.totalIncome === 3700, `esperava totalIncome 3700, recebeu ${summary.totalIncome}`);
    assert(summary.totalExpenses === 470, `esperava totalExpenses 470, recebeu ${summary.totalExpenses}`);
    assert(summary.balance === 3230, `esperava balance 3230, recebeu ${summary.balance}`);
  });

  await test('getMonthlyExpenses/getMonthlyIncome — filtram por mês de referência', async () => {
    const service = buildService();
    const thisMonth = new Date();
    const lastMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1, 15);

    await service.createExpense({ amount: 200, description: 'Deste mês', category: 'Mercado', date: thisMonth.toISOString() });
    await service.createExpense({ amount: 999, description: 'Mês passado', category: 'Mercado', date: lastMonth.toISOString() });
    await service.createIncome({ amount: 1000, description: 'Deste mês', category: 'Trabalho', date: thisMonth.toISOString() });

    const monthlyExpenses = await service.getMonthlyExpenses(thisMonth);
    assert(monthlyExpenses.length === 1, `esperava 1 despesa no mês corrente, recebeu ${monthlyExpenses.length}`);
    assert(monthlyExpenses[0]?.amount === 200, `esperava a despesa de 200, recebeu ${monthlyExpenses[0]?.amount}`);

    const monthlyIncome = await service.getMonthlyIncome(thisMonth);
    assert(monthlyIncome.length === 1, `esperava 1 receita no mês corrente, recebeu ${monthlyIncome.length}`);
  });

  // --- CONTROL OS — Fase 7: Contas ---------------------------------------

  await test('createAccount/listAccounts — cria conta, saldo inicial técnico e auditoria', async () => {
    const repository = new InMemoryFinanceRepository();
    const service = new PersistentFinanceService(repository, 'usr_test');
    const created = await service.createAccount({ name: 'Nubank', kind: 'conta_corrente', initialBalanceCents: 12_345, openingBalanceDate: '2026-07-01T12:00:00.000Z' });
    assert(created.success === true, `esperava sucesso, recebeu: ${created.message}`);

    const accounts = await service.listAccounts();
    assert(accounts.length === 1, `esperava 1 conta, recebeu ${accounts.length}`);
    assert(accounts[0]?.name === 'Nubank', `esperava conta "Nubank", recebeu "${accounts[0]?.name}"`);
    assert(accounts[0]?.currency === 'BRL', `esperava BRL, recebeu "${accounts[0]?.currency}"`);
    assert((await service.getAccountBalance(accounts[0]!.id)) === 123.45, 'saldo inicial precisa vir da movimentação técnica');
    const events = repository.getAuditEventsForTest('usr_test');
    assert(events.some((event) => event.operation === 'account.created'), 'criação da conta deve gerar auditoria');
    assert(events.some((event) => event.operation === 'transaction.account_opening_balance.created'), 'saldo inicial deve gerar auditoria própria');
  });

  await test('createAccount — rejeita nome duplicado (case-insensitive)', async () => {
    const service = new PersistentFinanceService(new InMemoryFinanceRepository(), 'usr_test');
    await service.createAccount({ name: 'Nubank' });
    const result = await service.createAccount({ name: 'nubank' });
    assert(result.success === false, 'esperava falha ao criar conta com nome já existente (case-insensitive)');
  });

  await test('updateAccount — bloqueia troca de moeda depois da primeira movimentação', async () => {
    const repository = new InMemoryFinanceRepository();
    const service = new PersistentFinanceService(repository, 'usr_test');
    const created = await service.createAccount({ name: 'Nubank', initialBalanceCents: 1 });
    const accountId = (created.data as { id: string }).id;
    const result = await service.updateAccount({ id: accountId, currency: 'USD' });
    assert(result.success === false, 'a moeda deve permanecer imutável depois de uma movimentação');
  });

  await test('archiveAccount/restoreAccount — preserva histórico sem exclusão física', async () => {
    const service = new PersistentFinanceService(new InMemoryFinanceRepository(), 'usr_test');
    const created = await service.createAccount({ name: 'Reserva', initialBalanceCents: 5_000 });
    const accountId = (created.data as { id: string }).id;
    assert((await service.archiveAccount(accountId)).success === true, 'esperava conseguir arquivar a conta');
    assert((await service.listAccounts()).length === 0, 'contas arquivadas não aparecem na lista padrão');
    const archived = await service.listAccounts({ includeArchived: true });
    assert(archived[0]?.status === 'arquivada', 'a conta precisa permanecer disponível como arquivada');
    assert((await service.getAccountBalance(accountId)) === 50, 'o histórico financeiro deve continuar preservado');
    assert((await service.restoreAccount(accountId)).success === true, 'esperava conseguir restaurar a conta');
    assert((await service.listAccounts())[0]?.status === 'ativa', 'a conta deve voltar a ficar ativa');
  });

  await test('createExpense sem conta — exige uma conta explícita, sem criar Carteira automaticamente', async () => {
    const service = new PersistentFinanceService(new InMemoryFinanceRepository(), 'usr_without_account');
    const result = await service.createExpense({ amount: 50, description: 'Café' });
    assert(result.success === false, 'esperava falha sem conta bancária selecionada');
    const accounts = await service.listAccounts();
    assert(accounts.length === 0, `não devia criar conta automaticamente, recebeu ${accounts.length}`);
  });

  // --- CONTROL OS — Fase 7: Categorias ------------------------------------

  await test('listCategories — inclui as 13 categorias padrão mesmo sem nenhuma criada', async () => {
    const service = buildService();
    const categories = await service.listCategories();
    assert(categories.length === 13, `esperava 13 categorias padrão, recebeu ${categories.length}`);
    assert(
      categories.every((category) => category.isDefault === true),
      'todas as categorias padrão devem vir com isDefault: true'
    );
    assert(
      categories.some((category) => category.name === 'Mercado'),
      'esperava "Mercado" entre as categorias padrão'
    );
  });

  await test('createCategory — persiste categoria personalizada sem substituir o catálogo padrão', async () => {
    const service = buildService();
    const created = await service.createCategory({ name: 'Pet', kind: 'despesa', color: '#F97316' });
    assert(created.success === true, `esperava sucesso, recebeu: ${created.message}`);
    const categories = await service.listCategories();
    assert(categories.length === 14, `esperava 13 padrão + 1 personalizada = 14, recebeu ${categories.length}`);
    const pet = categories.find((category) => category.name === 'Pet');
    assert(pet?.isDefault !== true && pet?.kind === 'despesa' && pet?.color === '#F97316', 'a categoria personalizada deve ter dados persistentes');
  });

  await test('createCategory — materializa uma categoria padrão ao personalizá-la', async () => {
    const service = buildService();
    const result = await service.createCategory({ name: 'Mercado', kind: 'despesa', icon: 'shopping-basket', color: '#22C55E' });
    assert(result.success === true, `esperava materializar Mercado, recebeu: ${result.message}`);
    const category = (await service.listCategories()).find((item) => item.name === 'Mercado');
    assert(category?.isDefault !== true && category?.status === 'ativa', 'Mercado deve se tornar categoria persistida do usuário');
  });

  await test('categorias — vínculo real, arquivamento e auditoria preservam o histórico', async () => {
    const repository = new InMemoryFinanceRepository();
    repository.seedAccountForTest('usr_categories');
    const service = new PersistentFinanceService(repository, 'usr_categories');
    const created = await service.createCategory({ name: 'Assinaturas', kind: 'despesa' });
    const categoryId = (created.data as { id: string }).id;
    const expense = await service.createExpense({ amount: 49.9, categoryId, description: 'Ferramenta' });
    assert(expense.success === true, `esperava registrar despesa: ${expense.message}`);
    assert((await service.listExpenses())[0]?.categoryId === categoryId, 'a transação deve guardar a FK da categoria');
    assert((await service.archiveCategory(categoryId)).success === true, 'a categoria deve ser arquivada, nunca excluída');
    assert(!(await service.listCategories()).some((item) => item.id === categoryId), 'categoria arquivada não aparece na lista ativa');
    assert((await service.listExpenses())[0]?.categoryId === categoryId, 'arquivar não pode apagar o vínculo histórico');
    assert((await service.restoreCategory(categoryId)).success === true, 'deve restaurar a categoria arquivada');
    assert(repository.getAuditEventsForTest('usr_categories').some((event) => event.operation === 'category.archived'), 'arquivamento deve gerar auditoria');
  });

  await test('categorias — edição, favoritos, ordenação e isolamento preservam a FK', async () => {
    const repository = new InMemoryFinanceRepository();
    repository.seedAccountForTest('usr_categories_a');
    repository.seedAccountForTest('usr_categories_b');
    const owner = new PersistentFinanceService(repository, 'usr_categories_a');
    const otherUser = new PersistentFinanceService(repository, 'usr_categories_b');
    const created = await owner.createCategory({ name: 'Cursos', kind: 'despesa', icon: 'briefcase', color: '#0EA5E9', sortOrder: 3, isFavorite: true });
    const categoryId = (created.data as { id: string }).id;
    await owner.createExpense({ amount: 100, description: 'Curso', categoryId });
    const updated = await owner.updateCategory({ id: categoryId, name: 'Educação', icon: 'heart-pulse', color: '#10B981', sortOrder: 1, isFavorite: false });
    assert(updated.success === true, `esperava atualizar categoria: ${updated.message}`);
    const category = (await owner.listCategories()).find((item) => item.id === categoryId);
    assert(category?.name === 'Educação' && category.icon === 'heart-pulse' && category.color === '#10B981' && category.sortOrder === 1 && category.isFavorite === false, 'edição deve persistir dados de apresentação');
    assert((await owner.listExpenses())[0]?.categoryId === categoryId, 'renomear categoria não pode quebrar o vínculo existente');
    assert(!(await otherUser.listCategories()).some((item) => item.id === categoryId), 'outro usuário não pode visualizar categoria privada');
    const foreignUpdate = await otherUser.updateCategory({ id: categoryId, name: 'Tentativa' });
    assert(foreignUpdate.success === false, 'outro usuário não pode alterar categoria privada');
    const auditOperations = repository.getAuditEventsForTest('usr_categories_a').map((event) => event.operation);
    assert(auditOperations.includes('category.created') && auditOperations.includes('category.updated'), 'criação e edição devem gerar auditoria');
  });

  // --- CONTROL OS — Fase 7: Transferências ---------------------------------

  await test('createTransfer — move saldo entre contas sem alterar o patrimônio total', async () => {
    const service = buildService();
    await service.createAccount({ name: 'Nubank' });
    await service.createIncome({ amount: 1000, description: 'Salário', accountName: 'Carteira' });
    const balanceBefore = await service.getBalance();

    const result = await service.createTransfer({ amount: 400, toAccountName: 'Nubank', fromAccountName: 'Carteira' });
    assert(result.success === true, `esperava sucesso, recebeu: ${result.message}`);

    const balanceAfter = await service.getBalance();
    assert(balanceAfter === balanceBefore, `patrimônio total não devia mudar: antes ${balanceBefore}, depois ${balanceAfter}`);

    const balances = await service.listAccountBalances();
    const carteira = balances.find((b) => b.accountName === 'Carteira');
    const nubank = balances.find((b) => b.accountName === 'Nubank');
    assert(carteira?.balance === 600, `esperava saldo 600 na Carteira, recebeu ${carteira?.balance}`);
    assert(nubank?.balance === 400, `esperava saldo 400 no Nubank, recebeu ${nubank?.balance}`);
  });

  await test('createTransfer — rejeita valor zero/negativo e conta de origem igual à de destino', async () => {
    const service = buildService();
    const zero = await service.createTransfer({ amount: 0, toAccountName: 'Nubank' });
    assert(zero.success === false, 'esperava falha para valor zero');

    const sameAccount = await service.createTransfer({ amount: 100, toAccountName: 'Carteira', fromAccountName: 'Carteira' });
    assert(sameAccount.success === false, 'esperava falha quando origem e destino são a mesma conta');
  });

  // --- CONTROL FINANCE — Sprint 2.1: núcleo de transações -----------------

  await test('transações — idempotência devolve o primeiro lançamento sem duplicar', async () => {
    const service = buildService();
    const input = {
      type: 'despesa' as const, amount: 72.5, description: 'Almoço', categoryId: 'default:Alimentação',
      accountId: await onlyAccountId(service), idempotencyKey: 'test-idempotency-expense-01', status: 'pendente' as const,
    };
    const first = await service.createTransaction(input);
    const repeated = await service.createTransaction(input);
    assert(first.success && repeated.success, 'as duas chamadas precisam retornar sucesso idempotente');
    assert((first.data as { id: string }).id === (repeated.data as { id: string }).id, 'o retry precisa retornar a mesma transação');
    assert((await service.listTransactions()).length === 1, 'a mesma chave não pode criar duas transações');
  });

  await test('transações — pendente não impacta realizado; confirmação passa a impactar', async () => {
    const service = buildService();
    const created = await service.createTransaction({
      type: 'receita', amount: 500, description: 'Venda prevista', categoryId: 'default:Freelance',
      accountId: await onlyAccountId(service), status: 'pendente',
    });
    const id = (created.data as { id: string }).id;
    assert((await service.getBalance()) === 0, 'uma transação pendente não pode alterar o saldo realizado');
    assert((await service.confirmTransaction(id)).success, 'a confirmação da pendência deve funcionar');
    assert((await service.getBalance()) === 500, 'a transação confirmada deve alterar o saldo realizado');
    assert((await service.updateTransaction({ id, amount: 600 })).success === false, 'transação confirmada não pode ser editada');
    assert((await service.cancelTransaction(id)).success === false, 'transação confirmada não pode ser cancelada');
  });

  await test('transações — categoria arquivada preserva histórico, mas bloqueia lançamento novo', async () => {
    const repository = new InMemoryFinanceRepository();
    const account = repository.seedAccountForTest('usr_archived_category');
    const service = new PersistentFinanceService(repository, 'usr_archived_category');
    const category = await service.createCategory({ name: 'Assinaturas', kind: 'despesa' });
    const categoryId = (category.data as { id: string }).id;
    const historic = await service.createTransaction({ type: 'despesa', amount: 50, description: 'Ferramenta', categoryId, accountId: account.id });
    assert(historic.success, 'a categoria ativa deve aceitar lançamento');
    await service.archiveCategory(categoryId);
    const blocked = await service.createTransaction({ type: 'despesa', amount: 50, description: 'Novo lançamento', categoryId, accountId: account.id });
    assert(blocked.success === false, 'uma categoria arquivada não pode ser usada em novo lançamento');
    assert((await service.listTransactions()).some((entry) => entry.categoryId === categoryId), 'o lançamento anterior precisa manter a referência histórica');
  });

  await test('transações — isolamento bloqueia alteração de outro usuário', async () => {
    const repository = new InMemoryFinanceRepository();
    const ownerAccount = repository.seedAccountForTest('usr_owner_transaction');
    repository.seedAccountForTest('usr_other_transaction');
    const owner = new PersistentFinanceService(repository, 'usr_owner_transaction');
    const other = new PersistentFinanceService(repository, 'usr_other_transaction');
    const created = await owner.createTransaction({ type: 'despesa', amount: 10, description: 'Privada', categoryId: 'default:Mercado', accountId: ownerAccount.id, status: 'pendente' });
    const id = (created.data as { id: string }).id;
    assert((await other.updateTransaction({ id, amount: 99 })).success === false, 'outro usuário não pode editar a transação');
    assert((await other.cancelTransaction(id)).success === false, 'outro usuário não pode cancelar a transação');
  });

  await test('transações — estorno é único, preserva original e remove efeito do saldo', async () => {
    const repository = new InMemoryFinanceRepository();
    const account = repository.seedAccountForTest('usr_reversal');
    const service = new PersistentFinanceService(repository, 'usr_reversal');
    const created = await service.createTransaction({ type: 'despesa', amount: 100, description: 'Compra errada', categoryId: 'default:Mercado', accountId: account.id });
    const id = (created.data as { id: string }).id;
    assert((await service.getBalance()) === -100, 'a despesa confirmada deve impactar o saldo');
    assert((await service.reverseTransaction(id)).success, 'o estorno da transação confirmada deve funcionar');
    assert((await service.getBalance()) === 0, 'o estorno deve retirar o efeito da transação original do saldo');
    assert((await service.reverseTransaction(id)).success === false, 'um lançamento já estornado não pode ser estornado novamente');
    const original = (await service.listTransactions()).find((entry) => entry.id === id);
    assert(original?.status === 'estornada', 'o lançamento original precisa permanecer auditável como estornado');
    assert(repository.getAuditEventsForTest('usr_reversal').some((event) => event.operation === 'transaction.reversed'), 'o estorno deve produzir evento de auditoria');
  });

  await test('transações — transferência inválida não deixa pernas parciais', async () => {
    const repository = new InMemoryFinanceRepository();
    const from = repository.seedAccountForTest('usr_atomic_transfer', 'Origem');
    const service = new PersistentFinanceService(repository, 'usr_atomic_transfer');
    const result = await service.createTransaction({ type: 'transferencia', amount: 90, fromAccountId: from.id, toAccountId: 'conta_inexistente' });
    assert(result.success === false, 'a transferência para conta inválida precisa falhar');
    assert((await service.listTransactions()).length === 0, 'falha de validação não pode criar perna parcial de transferência');
  });

  // --- CONTROL FINANCE — Sprint 3.0: Contas fixas e ocorrências ---------

  await test('contas fixas — gera ocorrências idempotentes com snapshot imutável', async () => {
    const repository = new InMemoryFinanceRepository();
    const account = repository.seedAccountForTest('usr_fixed_account');
    const service = new PersistentFinanceService(repository, 'usr_fixed_account');
    const category = await service.createCategory({ name: 'Internet residencial', kind: 'despesa' });
    const categoryId = (category.data as { id: string }).id;
    const created = await service.createFixedAccount({
      name: 'Internet', description: 'Plano inicial', type: 'despesa', categoryId,
      sourceAccountId: account.id, paymentMethod: 'conta_bancaria', amount: 119.9,
      recurrence: 'mensal', dueDay: 10, startDate: new Date().toISOString(),
    });
    assert(created.success, `esperava criar conta fixa: ${created.message}`);
    const fixedId = (created.data as { id: string }).id;
    const before = await service.listFixedAccountOccurrences({ fixedAccountId: fixedId });
    assert(before.length === 3, `esperava horizonte inicial de 3 ocorrências, recebeu ${before.length}`);
    const original = before[0]!;
    assert(original.name === 'Internet' && original.amount === 119.9 && original.categoryId === categoryId, 'a ocorrência precisa carregar o snapshot financeiro da criação');
    await service.generateFixedAccountOccurrences();
    assert((await service.listFixedAccountOccurrences({ fixedAccountId: fixedId })).length === before.length, 'geração repetida não pode duplicar a mesma competência');

    await service.updateFixedAccount({ id: fixedId, name: 'Internet fibra', amount: 149.9, description: 'Novo plano' });
    const future = new Date(); future.setMonth(future.getMonth() + 6);
    await service.generateFixedAccountOccurrences(future);
    const after = await service.listFixedAccountOccurrences({ fixedAccountId: fixedId });
    const persistedOriginal = after.find((item) => item.id === original.id);
    const newest = after[after.length - 1];
    assert(persistedOriginal?.name === 'Internet' && persistedOriginal.amount === 119.9, 'alterar a conta fixa não pode reescrever um mês já gerado');
    assert(newest?.name === 'Internet fibra' && newest.amount === 149.9, 'novas competências precisam usar a configuração atualizada');
    assert(repository.getAuditEventsForTest('usr_fixed_account').some((event) => event.operation === 'OCCURRENCE_GENERATED'), 'a geração precisa deixar auditoria própria');
  });

  await test('contas fixas — baixa cria transação pelo núcleo, suporta parcial e é idempotente', async () => {
    const repository = new InMemoryFinanceRepository();
    const account = repository.seedAccountForTest('usr_fixed_payment');
    const service = new PersistentFinanceService(repository, 'usr_fixed_payment');
    const category = await service.createCategory({ name: 'Aluguel', kind: 'despesa' });
    const fixed = await service.createFixedAccount({
      name: 'Aluguel', type: 'despesa', categoryId: (category.data as { id: string }).id,
      sourceAccountId: account.id, paymentMethod: 'conta_bancaria', amount: 1000,
      recurrence: 'mensal', dueDay: 5, startDate: new Date().toISOString(),
    });
    const occurrence = (await service.listFixedAccountOccurrences({ fixedAccountId: (fixed.data as { id: string }).id }))[0]!;
    const partial = await service.payFixedAccountOccurrence({ id: occurrence.id, amount: 400, idempotencyKey: 'fixed-partial-1' });
    assert(partial.success, `esperava pagamento parcial: ${partial.message}`);
    let updated = (await service.listFixedAccountOccurrences({ fixedAccountId: occurrence.fixedAccountId }))[0]!;
    assert(updated.status === 'parcial' && updated.paidAmount === 400, 'a ocorrência deve indicar pagamento parcial sem mudar o valor original');
    const repeated = await service.payFixedAccountOccurrence({ id: occurrence.id, amount: 400, idempotencyKey: 'fixed-partial-1' });
    assert(repeated.success, 'o retry com a mesma chave precisa retornar sucesso');
    assert((await service.listTransactions()).length === 1, 'retry de baixa não pode duplicar a transação financeira');
    const full = await service.payFixedAccountOccurrence({ id: occurrence.id });
    assert(full.success, `esperava quitar saldo restante: ${full.message}`);
    updated = (await service.listFixedAccountOccurrences({ fixedAccountId: occurrence.fixedAccountId }))[0]!;
    assert(updated.status === 'paga' && updated.paidAmount === 1000 && Boolean(updated.transactionId), 'quitação precisa vincular a ocorrência à transação real');
    assert((await service.getBalance()) === -1000, 'somente as transações confirmadas do núcleo devem afetar o saldo');
  });

  await test('contas fixas — cancelamento preserva histórico e só aceita pendência do próprio usuário', async () => {
    const repository = new InMemoryFinanceRepository();
    const account = repository.seedAccountForTest('usr_fixed_owner');
    const owner = new PersistentFinanceService(repository, 'usr_fixed_owner');
    const other = new PersistentFinanceService(repository, 'usr_fixed_other');
    const category = await owner.createCategory({ name: 'Condomínio', kind: 'despesa' });
    const fixed = await owner.createFixedAccount({ name: 'Condomínio', type: 'despesa', categoryId: (category.data as { id: string }).id, sourceAccountId: account.id, paymentMethod: 'conta_bancaria', amount: 300, recurrence: 'mensal', dueDay: 8, startDate: new Date().toISOString() });
    const occurrence = (await owner.listFixedAccountOccurrences({ fixedAccountId: (fixed.data as { id: string }).id }))[0]!;
    assert((await other.cancelFixedAccountOccurrence(occurrence.id)).success === false, 'outro usuário não pode cancelar ocorrência privada');
    assert((await owner.cancelFixedAccountOccurrence(occurrence.id)).success, 'o proprietário deve conseguir cancelar uma pendência');
    const cancelled = (await owner.listFixedAccountOccurrences({ fixedAccountId: occurrence.fixedAccountId }))[0];
    assert(cancelled?.status === 'cancelada', 'cancelamento não pode apagar a ocorrência');
    assert(repository.getAuditEventsForTest('usr_fixed_owner').some((event) => event.operation === 'OCCURRENCE_CANCELLED'), 'cancelamento deve gerar auditoria');
  });

  // --- CONTROL OS — Fase 7: Parcelamentos ----------------------------------

  await test('createInstallment — divide em N parcelas ligadas, sem deriva de ponto flutuante', async () => {
    const service = buildService();
    const result = await service.createInstallment({ totalAmount: 100, installments: 3, description: 'Notebook' });
    assert(result.success === true, `esperava sucesso, recebeu: ${result.message}`);

    const expenses = await service.listExpenses();
    assert(expenses.length === 3, `esperava 3 parcelas, recebeu ${expenses.length}`);

    const amounts = expenses.map((entry) => entry.amount).sort((a, b) => a - b);
    assert(amounts[0] === 33.33 && amounts[1] === 33.33 && amounts[2] === 33.34, `esperava 33.33/33.33/33.34, recebeu ${amounts.join('/')}`);

    const total = expenses.reduce((sum, entry) => sum + entry.amount, 0);
    assert(Math.round(total * 100) === 10000, `soma das parcelas devia bater com o total (100.00), recebeu ${total}`);

    const groupIds = new Set(expenses.map((entry) => entry.installmentGroupId));
    assert(groupIds.size === 1, 'todas as parcelas devem compartilhar o mesmo installmentGroupId');
    const numbers = expenses.map((entry) => entry.installmentNumber).sort();
    assert(numbers.join(',') === '1,2,3', `esperava installmentNumber 1,2,3, recebeu ${numbers.join(',')}`);
  });

  await test('createInstallment — rejeita menos de 2 parcelas e valor zero/negativo', async () => {
    const service = buildService();
    const oneInstallment = await service.createInstallment({ totalAmount: 100, installments: 1, description: 'X' });
    assert(oneInstallment.success === false, 'esperava falha com só 1 parcela');

    const zeroAmount = await service.createInstallment({ totalAmount: 0, installments: 3, description: 'X' });
    assert(zeroAmount.success === false, 'esperava falha com valor total zero');
  });

  // --- CONTROL OS — Fase 7: Recorrências -----------------------------------

  await test('createRecurring — cria só a primeira ocorrência, marcada com a frequência', async () => {
    const service = buildService();
    const result = await service.createRecurring({ amount: 89.9, description: 'Internet', frequency: 'mensal' });
    assert(result.success === true, `esperava sucesso, recebeu: ${result.message}`);

    const expenses = await service.listExpenses();
    assert(expenses.length === 1, `esperava 1 lançamento (só a primeira ocorrência), recebeu ${expenses.length}`);
    assert(expenses[0]?.recurrenceFrequency === 'mensal', `esperava recurrenceFrequency "mensal", recebeu "${expenses[0]?.recurrenceFrequency}"`);
  });

  // --- CONTROL OS — Fase 7: Consultas agregadas ----------------------------

  await test('getExpensesByCategory/getIncomeByCategory — agrupa e ordena por total', async () => {
    const service = buildService();
    await service.createExpense({ amount: 300, description: 'A', category: 'Mercado' });
    await service.createExpense({ amount: 100, description: 'B', category: 'Mercado' });
    await service.createExpense({ amount: 200, description: 'C', category: 'Combustível' });

    const breakdown = await service.getExpensesByCategory();
    assert(breakdown.length === 2, `esperava 2 categorias, recebeu ${breakdown.length}`);
    assert(breakdown[0]?.category === 'Mercado' && breakdown[0]?.total === 400, `esperava Mercado=400 em primeiro, recebeu ${JSON.stringify(breakdown[0])}`);
  });

  await test('getCashFlow — devolve um ponto por mês, mais recente por último', async () => {
    const service = buildService();
    await service.createIncome({ amount: 1000, description: 'Salário' });
    await service.createExpense({ amount: 200, description: 'Mercado' });

    const cashFlow = await service.getCashFlow(3);
    assert(cashFlow.length === 3, `esperava 3 pontos de fluxo de caixa, recebeu ${cashFlow.length}`);
    const now = new Date();
    const lastPoint = cashFlow[cashFlow.length - 1];
    assert(lastPoint?.year === now.getFullYear() && lastPoint?.month === now.getMonth() + 1, 'o último ponto do fluxo de caixa devia ser o mês corrente');
    assert(lastPoint?.balance === 800, `esperava saldo 800 no mês corrente, recebeu ${lastPoint?.balance}`);
  });

  await test('getDashboard — compõe saldo, resumo do mês, categorias, recentes e evolução', async () => {
    const service = buildService();
    await service.createIncome({ amount: 5000, description: 'Salário', category: 'Salário' });
    await service.createExpense({ amount: 250, description: 'Mercado', category: 'Mercado' });

    const dashboard = await service.getDashboard();
    assert(dashboard.currentBalance === 4750, `esperava saldo atual 4750, recebeu ${dashboard.currentBalance}`);
    assert(dashboard.monthIncome === 5000, `esperava receita do mês 5000, recebeu ${dashboard.monthIncome}`);
    assert(dashboard.monthExpenses === 250, `esperava despesa do mês 250, recebeu ${dashboard.monthExpenses}`);
    assert(dashboard.savings === 4750, `esperava economia 4750, recebeu ${dashboard.savings}`);
    assert(dashboard.recentTransactions.length === 2, `esperava 2 lançamentos recentes, recebeu ${dashboard.recentTransactions.length}`);
    assert(dashboard.monthlyEvolution.length === 6, `esperava 6 pontos de evolução mensal, recebeu ${dashboard.monthlyEvolution.length}`);
    assert(dashboard.topExpenseCategories.length === 1, `esperava 1 categoria de despesa, recebeu ${dashboard.topExpenseCategories.length}`);
  });

  // eslint-disable-next-line no-console -- script de teste standalone, não roda em produção.
  console.log(`\n${passed} passaram, ${failed} falharam.`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
