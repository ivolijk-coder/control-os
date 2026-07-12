import { parseIntent } from '../intent/parser';
import { buildPlan } from '../planner';
import { runIntent } from '../executor';
import { rememberTurn } from '../memory';
import type { NovaContext, NovaIntent, NovaTurnResult } from '../interfaces';

const FALLBACK_REPLY =
  'Ainda não sei executar essa ação específica, mas já registrei o que você disse. ' +
  'Você pode tentar: registrar um gasto, uma receita, criar um lembrete, um compromisso, uma meta ou um projeto.';

const ERROR_REPLY = 'Encontrei um problema ao executar isso. Pode tentar de novo com mais detalhes?';

function buildReply(intent: NovaIntent, ok: boolean): string {
  if (!ok) return ERROR_REPLY;

  switch (intent.kind) {
    case 'registrar_despesa':
      return `Prontinho. Registrei a despesa de R$ ${intent.amount.toFixed(2)} e já atualizei o Financeiro, o Dashboard e o Histórico.`;
    case 'registrar_receita':
      return `Prontinho. Registrei a receita de R$ ${intent.amount.toFixed(2)} e já atualizei o caixa e os indicadores.`;
    case 'criar_lembrete':
      return `Feito. Criei o lembrete "${intent.title}" em Missões.`;
    case 'criar_agenda':
      return `Feito. Adicionei "${intent.title}"${intent.time ? ` às ${intent.time}` : ''} na agenda e criei um lembrete vinculado.`;
    case 'criar_objetivo':
      return `Feito. Criei o objetivo "${intent.title}" em Missões.`;
    case 'criar_projeto':
      return `Feito. Criei o projeto "${intent.title}" em Missões.`;
    case 'desconhecido':
      return FALLBACK_REPLY;
  }
}

/**
 * Ponto de entrada único da Nova: intent → plano (checklist) → execução →
 * memória → resposta. "Primeiro faz. Depois responde." — a execução sempre
 * roda antes da resposta em texto ser formulada.
 *
 * Usado pelo `NovaWorkspace` (UI) e, futuramente, pelo adapter de WhatsApp
 * (`services/channels/whatsapp`) — mesma orquestração, independente do
 * canal de entrada.
 */
export async function processNovaTurn(text: string, ctx: NovaContext): Promise<NovaTurnResult> {
  const intent = parseIntent(text);
  const checklist = buildPlan(intent).map((step) => step.label);

  if (intent.kind === 'desconhecido') {
    rememberTurn(text);
    return { status: 'concluido', reply: FALLBACK_REPLY, checklist: [], results: [] };
  }

  const results = runIntent(ctx, intent);
  const ok = results.length > 0 && results.every((result) => result.ok);
  rememberTurn(text);

  return {
    status: ok ? 'concluido' : 'erro',
    reply: buildReply(intent, ok),
    checklist,
    results,
  };
}
