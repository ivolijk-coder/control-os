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
  return new PersistentFinanceService(new InMemoryFinanceRepository(), 'usr_test');
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

  // eslint-disable-next-line no-console -- script de teste standalone, não roda em produção.
  console.log(`\n${passed} passaram, ${failed} falharam.`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
