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

async function main(): Promise<void> {
  await test('createExpense — registra despesa e devolve ActionResult de sucesso', async () => {
    const service = buildService();
    const result = await service.createExpense({ amount: 350, description: 'Supermercado', category: 'Mercado' });
    assert(result.success === true, `esperava sucesso, recebeu: ${result.message}`);
    assert(result.message.includes('350'), `mensagem devia mencionar o valor: "${result.message}"`);
  });

  await test('updateExpense — edita uma despesa existente', async () => {
    const service = buildService();
    const created = await service.createExpense({ amount: 100, description: 'Padaria', category: 'Mercado' });
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

  await test('deleteExpense — remove uma despesa existente', async () => {
    const service = buildService();
    const created = await service.createExpense({ amount: 50, description: 'Farmácia', category: 'Saúde' });
    const id = (created.data as { id: string }).id;
    const deleted = await service.deleteExpense({ id });
    assert(deleted.success === true, `esperava sucesso, recebeu: ${deleted.message}`);
    const remaining = await service.listExpenses();
    assert(remaining.length === 0, `esperava lista vazia após excluir, recebeu ${remaining.length} item(ns)`);
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
    await service.deleteExpense({ id: expenseId });
    assert((await service.getBalance()) === 3200, `esperava saldo de volta a 3200 após excluir a despesa, recebeu ${await service.getBalance()}`);
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

  await test('createCategory — soma ao catálogo padrão (nunca substitui)', async () => {
    const service = buildService();
    const created = await service.createCategory({ name: 'Pet' });
    assert(created.success === true, `esperava sucesso, recebeu: ${created.message}`);
    const categories = await service.listCategories();
    assert(categories.length === 14, `esperava 13 padrão + 1 personalizada = 14, recebeu ${categories.length}`);
  });

  await test('createCategory — rejeita nome que colide com uma categoria padrão', async () => {
    const service = buildService();
    const result = await service.createCategory({ name: 'mercado' });
    assert(result.success === false, 'esperava falha ao criar categoria com nome de categoria padrão (case-insensitive)');
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
