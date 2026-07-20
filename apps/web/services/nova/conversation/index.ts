import { parseIntent } from '../intent/parser';
import { buildPlan } from '../planner';
import { runIntent } from '../executor';
import { rememberTurn } from '../memory';
import { buildDebtsSummary } from './debts-summary';
import { buildDailyCheckIn } from './daily-checkin';
import type { NovaContext, NovaIntent, NovaTurnResult } from '../interfaces';

const FALLBACK_REPLY =
  'Ainda não sei executar essa ação específica, mas já registrei o que você disse. ' +
  'Você pode tentar: registrar um gasto, uma receita, criar um lembrete, um compromisso, uma meta ou um projeto.';

const ERROR_REPLY = 'Encontrei um problema ao executar isso. Pode tentar de novo com mais detalhes?';

/**
 * Exportada (não só usada localmente) porque a camada de IA
 * (`services/ai/providers/MockAIProvider.ts`) reaproveita exatamente este
 * texto de confirmação — em vez de duplicar o `switch` por tipo de intent.
 */
export function buildReply(intent: NovaIntent, ok: boolean): string {
  if (!ok) return ERROR_REPLY;

  switch (intent.kind) {
    case 'registrar_despesa':
      return `Prontinho. Registrei a despesa de R$ ${intent.amount.toFixed(2)} e já atualizei o Financeiro, o Dashboard e o Histórico.`;
    case 'registrar_receita':
      return `Prontinho. Registrei a receita de R$ ${intent.amount.toFixed(2)} e já atualizei o caixa e os indicadores.`;
    case 'transferir_conta':
      return `Prontinho. Transferi R$ ${intent.amount.toFixed(2)} para ${intent.toAccountName} — seu patrimônio total não muda, só o saldo entre as contas.`;
    case 'parcelar_despesa':
      return `Prontinho. Parcelei "${intent.description}" em ${intent.installments}x de R$ ${(intent.totalAmount / intent.installments).toFixed(2)}.`;
    case 'criar_lembrete':
      return `Pronto. Já deixei programado${intent.dueDate ? ` para ${intent.dueDate}` : ''}${intent.time ? ` às ${intent.time}` : ''}.`;
    case 'criar_agenda':
      return `Feito. Adicionei "${intent.title}"${intent.date ? ` para ${intent.date}` : ''}${intent.time ? ` às ${intent.time}` : ''} na agenda e criei um lembrete vinculado.`;
    case 'criar_objetivo':
      return `Feito. Criei o objetivo "${intent.title}" em Missões.`;
    case 'criar_projeto':
      return `Feito. Criei o projeto "${intent.title}" em Missões.`;
    case 'registrar_divida':
      return `Prontinho. Registrei a dívida "${intent.description}" — R$ ${intent.totalAmount.toFixed(2)} em ${intent.installments}x — e já atualizei o Financeiro.`;
    case 'criar_habito':
      return `Feito. Criei o hábito "${intent.title}".`;
    case 'criar_viagem':
      return `Perfeito. Sua viagem para ${intent.destination} já está organizada, com um checklist inicial de preparação pronto.`;
    case 'criar_documento':
      return `Feito. Adicionei o documento "${intent.title}".`;
    case 'criar_bem':
      return `Feito. Registrei o bem "${intent.name}" em Patrimônio.`;
    case 'criar_nota':
      return `Feito. Criei a nota "${intent.title}".`;
    case 'consultar_dividas':
    case 'consultar_dia':
      // Nunca alcançado em runtime — `processNovaTurn` responde direto via `buildDebtsSummary`/`buildDailyCheckIn`, sem passar por `runIntent`/`buildReply`.
      return FALLBACK_REPLY;
    case 'desconhecido':
      return FALLBACK_REPLY;
  }
}

/**
 * Ponto de entrada único da Nova: intent → plano (checklist) → execução →
 * memória → resposta. "Primeiro faz. Depois responde." — a execução sempre
 * roda antes da resposta em texto ser formulada.
 *
 * Usado pelo `NovaWorkspace` (UI). CONTROL HUB (`services/control-hub`):
 * canais externos (WhatsApp — `channels/whatsapp` — e futuros) não chamam
 * isto diretamente nem nunca chamarão — passam sempre por
 * `controlHub.receive`, que fala com a NOVA através do `NovaGateway`
 * (`services/control-hub/nova-gateway.ts`), mock nesta fase. Mesma
 * orquestração de sempre, agora com um único ponto de entrada
 * independente do canal.
 */
export async function processNovaTurn(text: string, ctx: NovaContext): Promise<NovaTurnResult> {
  const intent = parseIntent(text);
  const checklist = buildPlan(intent).map((step) => step.label);

  if (intent.kind === 'desconhecido') {
    await rememberTurn(text);
    return { status: 'concluido', reply: FALLBACK_REPLY, checklist: [], results: [] };
  }

  if (intent.kind === 'consultar_dividas') {
    await rememberTurn(text);
    return { status: 'concluido', reply: buildDebtsSummary(ctx.debts), checklist: [], results: [] };
  }

  if (intent.kind === 'consultar_dia') {
    await rememberTurn(text);
    const reply = buildDailyCheckIn(ctx.missions, ctx.agendaEvents, ctx.financeEntries, ctx.habits, ctx.userName);
    return { status: 'concluido', reply, checklist: [], results: [] };
  }

  const results = runIntent(ctx, intent);
  const ok = results.length > 0 && results.every((result) => result.ok);
  await rememberTurn(text);

  return {
    status: ok ? 'concluido' : 'erro',
    reply: buildReply(intent, ok),
    checklist,
    results,
  };
}
