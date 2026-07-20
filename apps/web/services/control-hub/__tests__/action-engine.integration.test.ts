/**
 * Testes de integração do Action Engine real (CONTROL HUB — Fase 4).
 * "Criar pequenos testes de integração utilizando mocks... Validar todo o
 * fluxo: Hub → Decision → Action → Service → Resposta."
 *
 * Este arquivo NÃO depende de nenhum test runner (Jest/Vitest) — nenhum dos
 * dois está instalado neste projeto ainda (sem acesso ao registry npm neste
 * sandbox para instalar um). `test()`/`assert()` abaixo são um harness
 * mínimo, propositalmente parecido com a API de qualquer runner comum
 * (`describe`/`it`) — se o projeto adotar Vitest/Jest no futuro, converter
 * é mecânico: trocar `test(name, fn)` por `it(name, fn)`, sem tocar o corpo
 * de nenhum caso.
 *
 * Execução: `node --experimental-strip-types` (Node 22+, suporte nativo a
 * TypeScript) resolve todo `import type`/tipos desta cadeia sem problema,
 * mas os aliases `@/*`/`@control-os/*` (`tsconfig.json`) não são conhecidos
 * pelo Node puro — precisam de um resolvedor de módulo (hook de
 * `--experimental-loader`) para rodar fora do bundler do Next.js. Ver o
 * relatório desta fase para o comando completo usado para validar isto.
 *
 * Casos: `expense.create` e `calendar.create` rodam de ponta a ponta via
 * `controlHub.receive(...)` (Hub → Decision → Action → Service → Resposta),
 * usando os dois exemplos literais do pedido original. `note.create` é
 * testado direto contra o Action Registry (Action → Service) — achado da
 * auditoria: `parseIntent` (`services/nova/intent/parser.ts`) ainda não tem
 * nenhum padrão de regex que produza `criar_nota`/`criar_documento` (só a
 * OpenAI, via Tool Calling, propõe essas intents hoje) — ensinar o parser
 * mock a reconhecer "anota isso..." é uma mudança de escopo diferente
 * (`services/nova`, não `services/control-hub`/`services/action-engine`) e
 * fica para uma fase futura de Decision Engine.
 */
import { controlHub } from '../control-hub.service';
import { actionRegistry } from '@/services/action-engine';
import type { HubMessage } from '../control-hub.types';

let passed = 0;
let failed = 0;

/** `boolean | undefined` (não só `boolean`): algumas asserções encadeiam optional chaining (`actionResult?.message.includes(...)`) — a cadeia inteira vira `undefined` quando `actionResult` é `undefined`, o que é exatamente uma falha de asserção válida, não um erro de tipo. */
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

function buildMessage(content: string): HubMessage {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    channel: 'api',
    userId: 'usr_test',
    type: 'text',
    content,
    receivedAt: new Date(),
  };
}

async function main(): Promise<void> {
  await test('expense.create — "Gastei R$ 350 no supermercado" (Hub → Decision → Action → Service → Resposta)', async () => {
    const result = await controlHub.receive(buildMessage('Gastei R$ 350 no supermercado'));
    assert(result.status === 'ok', `status esperado 'ok', recebido '${result.status}'`);
    assert(result.actionResults !== undefined, 'esperava actionResults preenchido (decisão devia virar expense.create)');
    assert(result.actionResults?.length === 1, `esperava 1 actionResult, recebeu ${result.actionResults?.length}`);
    const [actionResult] = result.actionResults ?? [];
    assert(actionResult?.success === true, `esperava sucesso, recebeu: ${actionResult?.message}`);
    assert(typeof result.reply === 'string' && result.reply.includes('350'), `reply devia mencionar o valor: "${result.reply}"`);
  });

  await test('calendar.create — "Amanhã às 15h reunião com Ricardo" (Hub → Decision → Action → Service → Resposta)', async () => {
    const result = await controlHub.receive(buildMessage('Amanhã às 15h reunião com Ricardo'));
    assert(result.status === 'ok', `status esperado 'ok', recebido '${result.status}'`);
    assert(result.actionResults?.length === 1, `esperava 1 actionResult, recebeu ${result.actionResults?.length}`);
    const [actionResult] = result.actionResults ?? [];
    assert(actionResult?.success === true, `esperava sucesso, recebeu: ${actionResult?.message}`);
    assert(typeof result.reply === 'string' && result.reply.length > 0, 'esperava um reply não vazio');
  });

  await test('note.create — Action Registry → NotesService (Action → Service → Resposta)', async () => {
    const [actionResult] = await actionRegistry.execute([
      { kind: 'note.create', payload: { title: 'Ideia de conteúdo', content: 'Gravar um vídeo sobre o Action Engine.' } },
    ]);
    assert(actionResult?.success === true, `esperava sucesso, recebeu: ${actionResult?.message}`);
    assert(actionResult?.message.includes('Ideia de conteúdo'), `mensagem devia mencionar o título: "${actionResult?.message}"`);
  });

  await test('mensagem não reconhecida continua respondendo (kind: reply), sem inventar ação', async () => {
    const result = await controlHub.receive(buildMessage('isso não deveria virar nenhuma ação conhecida'));
    assert(result.status === 'ok', `status esperado 'ok', recebido '${result.status}'`);
    assert(result.actionResults === undefined, 'não esperava actionResults para uma mensagem sem ação reconhecida');
    assert(typeof result.reply === 'string' && result.reply.length > 0, 'esperava um reply de fallback não vazio');
  });

  // eslint-disable-next-line no-console -- script de teste standalone, não roda em produção.
  console.log(`\n${passed} passaram, ${failed} falharam.`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
