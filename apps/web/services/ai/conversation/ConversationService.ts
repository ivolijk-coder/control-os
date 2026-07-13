import { buildDailyCheckIn, buildDebtsSummary, buildPlan, buildReply, rememberTurn } from '@/services/nova';

/**
 * Mesmo texto de `services/nova/conversation/index.ts` (`FALLBACK_REPLY`) —
 * duplicada aqui (uma constante de string, não lógica) porque `desconhecido`
 * precisa de tratamento especial ANTES de `buildReply`/`ActionExecutor`:
 * diferente de uma ação que falhou (`ok = false` → `ERROR_REPLY`), uma
 * mensagem não reconhecida é um resultado "concluído" (a NOVA só não sabe
 * executar aquilo ainda) — mesma distinção que `processNovaTurn` já fazia.
 */
const FALLBACK_REPLY =
  'Ainda não sei executar essa ação específica, mas já registrei o que você disse. ' +
  'Você pode tentar: registrar um gasto, uma receita, criar um lembrete, um compromisso, uma meta ou um projeto.';
import type { NovaContext, NovaTurnResult } from '@/services/nova';
import { getAIProvider } from '../config';
import type { AIConversationContext } from '../types';
import { ActionExecutor } from './ActionExecutor';
import { IntentResolver } from './IntentResolver';

const intentResolver = new IntentResolver();
const actionExecutor = new ActionExecutor();

/** Recorta de `NovaContext` só o que o `AIProvider` pode ler — nunca `actions`. */
function toAIConversationContext(ctx: NovaContext): AIConversationContext {
  return {
    userName: ctx.userName,
    debts: ctx.debts,
    missions: ctx.missions,
    agendaEvents: ctx.agendaEvents,
    financeEntries: ctx.financeEntries,
    habits: ctx.habits,
  };
}

/**
 * Ponto de entrada único da camada de IA (CONTROL OS — Preparação para
 * OpenAI GPT-5.5): Nova (UI) → `ConversationService` → `AIProvider` →
 * `IntentResolver` → `ActionExecutor` → Banco de Dados.
 *
 * "Nenhuma tela pode acessar a IA diretamente" — `NovaWorkspace` chama só
 * `processTurn`, nunca `getAIProvider()`/`MockAIProvider` diretamente.
 * "Toda conversa deve passar pelo MockAIProvider" — `getAIProvider()` hoje
 * sempre devolve o Mock (`AI_PROVIDER=mock`), então toda classificação de
 * intenção passa por ele.
 *
 * Mesmos passos que `services/nova/conversation/processNovaTurn` já fazia
 * (classificar → responder leitura ou executar → lembrar → responder) —
 * "Nenhuma funcionalidade atual pode parar de funcionar" — só que agora
 * formalizados através da interface `AIProvider` e das Actions nomeadas,
 * em vez de chamar o parser e o executor legado diretamente.
 */
export class ConversationService {
  async processTurn(text: string, ctx: NovaContext): Promise<NovaTurnResult> {
    const provider = getAIProvider();
    const aiContext = toAIConversationContext(ctx);
    const intent = await provider.classifyIntent(text, aiContext);

    if (intent.kind === 'desconhecido') {
      rememberTurn(text);
      return { status: 'concluido', reply: FALLBACK_REPLY, checklist: [], results: [] };
    }

    if (intent.kind === 'consultar_dividas') {
      rememberTurn(text);
      return { status: 'concluido', reply: buildDebtsSummary(ctx.debts), checklist: [], results: [] };
    }

    if (intent.kind === 'consultar_dia') {
      rememberTurn(text);
      const reply = buildDailyCheckIn(ctx.missions, ctx.agendaEvents, ctx.financeEntries, ctx.habits, ctx.userName);
      return { status: 'concluido', reply, checklist: [], results: [] };
    }

    const action = intentResolver.resolve(intent);
    const checklist = buildPlan(intent).map((step) => step.label);
    const results = actionExecutor.execute(ctx, intent, action);
    const ok = results.length > 0 && results.every((result) => result.ok);
    rememberTurn(text);

    return {
      status: ok ? 'concluido' : 'erro',
      reply: buildReply(intent, ok),
      checklist,
      results,
    };
  }
}
