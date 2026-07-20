/**
 * Testes do Decision Engine com IA (CONTROL HUB — Fase 5). "Criar pequenos
 * testes de integração... Cobrir: JSON válido, JSON inválido, Action
 * inexistente, Confidence baixa, múltiplas Actions, nenhuma Action. Validar
 * todo o fluxo."
 *
 * Mesmo harness mínimo (sem Jest/Vitest — nenhum instalado neste projeto,
 * sandbox sem acesso à registry do npm) já usado em
 * `services/control-hub/__tests__/action-engine.integration.test.ts` —
 * `test()`/`assert()` propositalmente parecidos com `it`/`expect` de
 * qualquer runner comum, pra uma migração futura ser mecânica.
 *
 * Duas camadas testadas:
 *   1. `parseLLMDecisionResponse` — os 6 casos pedidos, como função pura
 *      (nenhum I/O, nenhum modelo real necessário).
 *   2. `OpenAIDecisionProvider.decide` — fluxo completo (Prompt Builder →
 *      `LLMProvider` → validação), com um `MockLLMProvider` injetado no
 *      lugar da OpenAI de verdade (sem rede, sem custo, determinístico) —
 *      "validar todo o fluxo" ponta a ponta, exatamente como pedido.
 */
import { parseLLMDecisionResponse } from '../parse-llm-decision';
import { capabilityRegistry } from '../capability-registry';
import { OpenAIDecisionProvider } from '../openai-decision-provider';
import { MockLLMProvider } from '@/services/llm';
import type { HubMessage } from '@/services/control-hub';
import type { UserContext } from '@/services/context-provider';

let passed = 0;
let failed = 0;

function assert(condition: boolean | undefined, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
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

/** Contexto mínimo válido — só o suficiente pro Prompt Builder rodar sem tocar nenhuma fonte de dados real. */
function buildEmptyContext(): UserContext {
  return {
    profile: { id: 'usr_test', name: 'Usuário de Teste' },
    agenda: [],
    finance: [],
    goals: [],
    habits: [],
    assets: [],
    notes: [],
    documents: [],
    recentConversations: [],
  };
}

async function main(): Promise<void> {
  // --- parseLLMDecisionResponse — os 6 casos pedidos ---------------------

  await test('JSON válido — uma ação registrada, confiança alta → execute_actions', () => {
    const raw = '{"actions":[{"kind":"expense.create","confidence":0.98,"parameters":{"value":350,"category":"Supermercado"}}]}';
    const result = parseLLMDecisionResponse(raw, capabilityRegistry);
    assert(result.kind === 'execute_actions', `esperava 'execute_actions', recebeu '${result.kind}'`);
    assert(result.actions.length === 1, `esperava 1 ação, recebeu ${result.actions.length}`);
    assert(result.actions[0]?.kind === 'expense.create', 'esperava kind expense.create');
    assert(result.actions[0]?.payload.value === 350, 'esperava value 350 no payload');
  });

  await test('JSON inválido — texto não parseável → reply, nenhuma ação', () => {
    const result = parseLLMDecisionResponse('isso não é JSON nenhum {{{', capabilityRegistry);
    assert(result.kind === 'reply', `esperava 'reply', recebeu '${result.kind}'`);
    assert(result.actions.length === 0, 'esperava zero ações');
    assert(typeof result.reply === 'string' && result.reply.length > 0, 'esperava um reply de fallback não vazio');
  });

  await test('Action inexistente — kind não registrado é ignorado, não derruba o resultado', () => {
    const raw = '{"actions":[{"kind":"lancar_foguete","confidence":0.99,"parameters":{}}]}';
    const result = parseLLMDecisionResponse(raw, capabilityRegistry);
    assert(result.kind === 'reply', `esperava 'reply' (nenhuma ação válida sobrou), recebeu '${result.kind}'`);
    assert(result.actions.length === 0, 'esperava zero ações — Action inexistente nunca deveria executar');
  });

  await test('Confidence baixa — ação registrada e válida, mas confiança abaixo do mínimo, não executa', () => {
    const raw = '{"actions":[{"kind":"expense.create","confidence":0.2,"parameters":{"value":50}}]}';
    const result = parseLLMDecisionResponse(raw, capabilityRegistry);
    assert(result.kind === 'reply', `esperava 'reply' (confiança baixa demais), recebeu '${result.kind}'`);
    assert(result.actions.length === 0, 'esperava zero ações — confiança abaixo do mínimo não deveria executar');
  });

  await test('Múltiplas Actions — duas ações válidas no mesmo lote → execute_actions com as duas', () => {
    const raw =
      '{"actions":[' +
      '{"kind":"expense.create","confidence":0.9,"parameters":{"value":100}},' +
      '{"kind":"note.create","confidence":0.85,"parameters":{"title":"Ideia"}}' +
      ']}';
    const result = parseLLMDecisionResponse(raw, capabilityRegistry);
    assert(result.kind === 'execute_actions', `esperava 'execute_actions', recebeu '${result.kind}'`);
    assert(result.actions.length === 2, `esperava 2 ações, recebeu ${result.actions.length}`);
  });

  await test('Múltiplas Actions — uma válida e uma com Action inexistente: só a válida sobrevive', () => {
    const raw =
      '{"actions":[' +
      '{"kind":"expense.create","confidence":0.9,"parameters":{"value":100}},' +
      '{"kind":"nao_existe","confidence":0.9,"parameters":{}}' +
      ']}';
    const result = parseLLMDecisionResponse(raw, capabilityRegistry);
    assert(result.kind === 'execute_actions', `esperava 'execute_actions', recebeu '${result.kind}'`);
    assert(result.actions.length === 1, `esperava 1 ação sobrevivente, recebeu ${result.actions.length}`);
    assert(result.actions[0]?.kind === 'expense.create', 'esperava que só expense.create sobrevivesse');
  });

  await test('Nenhuma Action — {"actions":[]} → reply, sem executar nada', () => {
    const result = parseLLMDecisionResponse('{"actions":[]}', capabilityRegistry);
    assert(result.kind === 'reply', `esperava 'reply', recebeu '${result.kind}'`);
    assert(result.actions.length === 0, 'esperava zero ações');
    assert(typeof result.reply === 'string' && result.reply.length > 0, 'esperava um reply de confirmação não vazio');
  });

  await test('Parâmetro obrigatório ausente — Action registrada, mas falta parâmetro required, é ignorada', () => {
    // `expense.create` exige "value" (número) — omitido de propósito.
    const raw = '{"actions":[{"kind":"expense.create","confidence":0.9,"parameters":{"category":"Mercado"}}]}';
    const result = parseLLMDecisionResponse(raw, capabilityRegistry);
    assert(result.kind === 'reply', `esperava 'reply' (parâmetro obrigatório ausente), recebeu '${result.kind}'`);
    assert(result.actions.length === 0, 'esperava zero ações — parâmetro obrigatório ausente não deveria executar');
  });

  // --- OpenAIDecisionProvider — fluxo completo, LLMProvider mockado -------

  await test('OpenAIDecisionProvider — fluxo completo com MockLLMProvider: "Gastei R$ 350 no mercado"', async () => {
    const llmResponse = '{"actions":[{"kind":"expense.create","confidence":0.98,"parameters":{"value":350,"category":"Supermercado"}}]}';
    const provider = new OpenAIDecisionProvider(new MockLLMProvider([llmResponse]));
    const result = await provider.decide(buildMessage('Gastei R$ 350 no mercado'), buildEmptyContext());
    assert(result.kind === 'execute_actions', `esperava 'execute_actions', recebeu '${result.kind}'`);
    assert(result.actions.length === 1, `esperava 1 ação, recebeu ${result.actions.length}`);
    assert(result.actions[0]?.kind === 'expense.create', 'esperava kind expense.create');
  });

  await test('OpenAIDecisionProvider — falha do LLMProvider vira reply amigável, nunca lança', async () => {
    const provider = new OpenAIDecisionProvider({
      complete: async () => {
        throw new Error('falha de rede simulada');
      },
    });
    const result = await provider.decide(buildMessage('qualquer mensagem'), buildEmptyContext());
    assert(result.kind === 'reply', `esperava 'reply' (falha tratada), recebeu '${result.kind}'`);
    assert(typeof result.reply === 'string' && result.reply.length > 0, 'esperava um reply amigável não vazio');
    assert(result.actions.length === 0, 'esperava zero ações após falha do LLMProvider');
  });

  // eslint-disable-next-line no-console -- script de teste standalone, não roda em produção.
  console.log(`\n${passed} passaram, ${failed} falharam.`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
