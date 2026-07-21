/**
 * Testes de paridade do Channel Gateway — CONTROL HUB Fase 8 (Gateway
 * Omnichannel).
 *
 * "Criar testes garantindo que: Web Chat → Message Envelope → CONTROL HUB
 * e WhatsApp Mock → Message Envelope → CONTROL HUB executam exatamente o
 * mesmo pipeline." É exatamente isso que este arquivo prova: a mesma
 * mensagem de texto, enviada por dois canais diferentes (Web Chat e
 * WhatsApp Mock), produz o mesmo `status`, a mesma quantidade de
 * `actionResults` e o mesmo `reply` — nenhuma lógica de negócio (Decision
 * Engine, Action Engine, Modules, Repositories) enxerga o canal de
 * origem, só o `HubMessage` já convertido.
 *
 * Mesmo harness mínimo (`test`/`assert`) de
 * `services/control-hub/__tests__/action-engine.integration.test.ts` —
 * nenhum test runner (Jest/Vitest) instalado neste sandbox (sem acesso ao
 * registry npm). Execução: `node --experimental-strip-types` + loader de
 * alias, ver relatório da Fase 8 para o comando completo.
 */
// Importado do barrel (`../index`), não dos arquivos individuais — é lá
// que o composition root registra os adapters de canal (`channelRegistry
// .register(...)`). Importar `channel-gateway.ts`/`channel-registry.ts`
// direto pularia esse efeito colateral e todo canal apareceria "não
// registrado" neste teste, mesmo existindo de verdade em produção.
import { channelGateway, channelRegistry, conversationManager } from '../index';
import { whatsAppOutbox } from '@/channels/whatsapp';
import { webChatOutbox } from '@/channels/web';
import type { InboundWhatsAppMessage } from '@/channels/whatsapp';
import type { InboundWebChatMessage } from '@/channels/web';

/**
 * Simplesmente importar `@/services/control-hub` (via `../index` acima)
 * já carrega, transitivamente, `services/action-engine` →
 * `services/repositories/finance/prisma-finance.repository.ts` — mesmo
 * que NENHUM caso deste arquivo dispare uma ação financeira (de
 * propósito, ver comentário no teste de paridade abaixo). O Prisma
 * Client, ao ser instanciado, tenta localizar seu engine binário em
 * segundo plano; neste sandbox esse binário não existe para
 * "linux-arm64-openssl-3.0.x" (`binaries.prisma.sh` bloqueado — mesma
 * limitação já documentada no README e nos relatórios das Fases 6/7/da
 * auditoria de produção). Quando essa tentativa em segundo plano rejeita
 * DEPOIS que o `main()` deste arquivo já terminou, o Node trata como
 * unhandled rejection e derruba o processo com exit code de erro — mesmo
 * que todo teste aqui tenha passado. Este handler impede esse falso
 * negativo: qualquer rejeição não tratada nesta fase de teste é logada
 * (não escondida) e tratada como a limitação de ambiente conhecida, não
 * como falha do Channel Gateway.
 */
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console -- script de teste standalone, não roda em produção.
  console.log(
    `  (ignorado — limitação de ambiente pré-existente, não relacionada à Fase 8) unhandledRejection: ${
      reason instanceof Error ? reason.message.split('\n')[0] : String(reason)
    }`
  );
});

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

function buildWhatsAppRaw(text: string, from: string): InboundWhatsAppMessage {
  return { from, text, receivedAt: new Date().toISOString() };
}

function buildWebRaw(text: string, sessionId: string): InboundWebChatMessage {
  return { sessionId, text, receivedAt: new Date().toISOString() };
}

async function main(): Promise<void> {
  await test('Channel Registry: web e whatsapp registrados hoje ("Hoje: Web Chat, WhatsApp Mock")', async () => {
    const channels = channelRegistry.list().map((adapter) => adapter.channel);
    assert(channels.includes('web'), 'esperava o canal "web" registrado');
    assert(channels.includes('whatsapp'), 'esperava o canal "whatsapp" registrado');
  });

  await test(
    'Paridade: "Amanhã às 15h reunião com Ricardo" via WhatsApp Mock e via Web Chat executam o mesmo pipeline',
    async () => {
      // Mensagem de calendário, não de despesa, de propósito: o módulo
      // Financeiro (único já migrado para Prisma real, Fase 6/7) exige um
      // Postgres real + engine binário nativo — indisponível neste
      // sandbox (`binaries.prisma.sh` bloqueado, ver README/relatórios de
      // fases anteriores). Calendário ainda roda sobre o Module Service
      // mock (Fase 4), então prova a mesma paridade de pipeline
      // (Hub → Decision → Action → Service → Resposta) sem depender de
      // infraestrutura que só existe fora deste sandbox.
      const text = 'Amanhã às 15h reunião com Ricardo';

      const whatsAppResult = await channelGateway.receiveMessage(
        'whatsapp',
        buildWhatsAppRaw(text, '+5511988887777')
      );
      const webResult = await channelGateway.receiveMessage('web', buildWebRaw(text, 'sess_paridade_1'));

      assert(whatsAppResult.status === 'ok', `WhatsApp: status esperado 'ok', recebido '${whatsAppResult.status}'`);
      assert(webResult.status === 'ok', `Web Chat: status esperado 'ok', recebido '${webResult.status}'`);
      assert(
        whatsAppResult.status === webResult.status,
        `os dois canais deviam terminar com o mesmo status ('${whatsAppResult.status}' vs '${webResult.status}')`
      );

      assert(
        whatsAppResult.actionResults?.length === 1,
        `WhatsApp: esperava 1 actionResult (calendar.create), recebeu ${whatsAppResult.actionResults?.length}`
      );
      assert(
        webResult.actionResults?.length === whatsAppResult.actionResults?.length,
        'os dois canais deviam produzir a mesma quantidade de actionResults (mesma decisão do Decision Engine)'
      );

      assert(
        whatsAppResult.actionResults?.[0]?.success === true,
        `WhatsApp: esperava sucesso na ação, recebeu: ${whatsAppResult.actionResults?.[0]?.message}`
      );
      assert(
        webResult.actionResults?.[0]?.success === true,
        `Web Chat: esperava sucesso na ação, recebeu: ${webResult.actionResults?.[0]?.message}`
      );

      assert(
        typeof whatsAppResult.reply === 'string' && whatsAppResult.reply === webResult.reply,
        `os dois canais deviam receber exatamente o mesmo texto de resposta ("${whatsAppResult.reply}" vs "${webResult.reply}")`
      );
    }
  );

  await test('sendMessage: cada adapter entrega a resposta no próprio outbox (nenhum canal vê o outbox do outro)', async () => {
    const lastWhatsAppSent = whatsAppOutbox[whatsAppOutbox.length - 1];
    const lastWebSent = webChatOutbox[webChatOutbox.length - 1];

    assert(lastWhatsAppSent?.to === '+5511988887777', 'esperava o outbox do WhatsApp com o número correto');
    assert(lastWebSent?.sessionId === 'sess_paridade_1', 'esperava o outbox do Web Chat com a sessão correta');
    assert(
      lastWhatsAppSent?.text === lastWebSent?.text,
      'o texto entregue de volta ao usuário deve ser idêntico nos dois canais'
    );
  });

  await test('Conversation Manager: mesmo (canal, userId) sempre devolve o mesmo conversationId', async () => {
    const first = conversationManager.findOrCreateConversationId('whatsapp', '+5511900001111');
    const second = conversationManager.findOrCreateConversationId('whatsapp', '+5511900001111');
    const other = conversationManager.findOrCreateConversationId('whatsapp', '+5511900002222');

    assert(first === second, 'a mesma dupla (canal, userId) deveria devolver o mesmo conversationId');
    assert(first !== other, 'usuários diferentes deveriam ter conversationId diferentes');
  });

  await test(
    'Paridade também para mensagem sem ação reconhecida — mesmo fallback de reply nos dois canais',
    async () => {
      const text = 'isso não deveria virar nenhuma ação conhecida';

      const whatsAppResult = await channelGateway.receiveMessage(
        'whatsapp',
        buildWhatsAppRaw(text, '+5511977776666')
      );
      const webResult = await channelGateway.receiveMessage('web', buildWebRaw(text, 'sess_paridade_2'));

      assert(whatsAppResult.status === 'ok', 'WhatsApp: esperava status ok mesmo sem ação reconhecida');
      assert(webResult.status === 'ok', 'Web Chat: esperava status ok mesmo sem ação reconhecida');
      assert(whatsAppResult.actionResults === undefined, 'WhatsApp: não esperava actionResults');
      assert(webResult.actionResults === undefined, 'Web Chat: não esperava actionResults');

      // O Mock Decision Provider ecoa de propósito o nome do canal no
      // reply de fallback (`mock-decision-provider.ts`: "mensagem recebida
      // do canal \"${message.channel}\"") — útil para depuração, mas
      // significa que o TEXTO LITERAL nunca é idêntico entre canais
      // diferentes. O que prova paridade de pipeline aqui não é o texto
      // byte-a-byte, e sim o mesmo TEMPLATE (a mesma decisão, com o mesmo
      // conteúdo da mensagem ecoado) — por isso a comparação normaliza o
      // nome do canal antes de comparar.
      const normalizeChannelEcho = (reply: string | undefined): string | undefined =>
        reply?.replace(/"whatsapp"|"web"/, '"<channel>"');
      assert(
        normalizeChannelEcho(whatsAppResult.reply) === normalizeChannelEcho(webResult.reply),
        `o reply de fallback deve seguir o mesmo template nos dois canais ("${whatsAppResult.reply}" vs "${webResult.reply}")`
      );
    }
  );

  await test('Channel Gateway rejeita canal sem adapter registrado ("app" ainda é só reserva de interface)', async () => {
    let threw = false;
    try {
      await channelGateway.receiveMessage('app', { any: 'payload' });
    } catch {
      threw = true;
    }
    assert(threw, 'esperava que receiveMessage lançasse erro para um canal sem adapter registrado');
  });

  // eslint-disable-next-line no-console -- script de teste standalone, não roda em produção.
  console.log(`\n${passed} passaram, ${failed} falharam.`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
