import { buildDailyCheckIn, buildDebtsSummary, buildPlan, buildReply, rememberTurn } from '@/services/nova';
import type { NovaContext, NovaIntent, NovaTurnResult } from '@/services/nova';
import { getAIProvider } from '../config';
import type { AIConversationContext } from '../types';
import type { Action } from '../actions';
import { ActionExecutor } from './ActionExecutor';
import { buildConfirmationPreview, CANCEL_PATTERN, CONFIRM_PATTERN, isSensitiveIntent } from './confirmation';
import { IntentResolver } from './IntentResolver';

const intentResolver = new IntentResolver();
const actionExecutor = new ActionExecutor();

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

const NO_PENDING_ACTION_REPLY = 'Não havia nenhuma ação pendente de confirmação.';
const CANCELLED_REPLY = 'Ok, não fiz nada.';

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

interface PendingTurn {
  intent: NovaIntent;
  action: Action | undefined;
}

/**
 * Ponto de entrada único da camada de IA (CONTROL OS — Preparação para
 * OpenAI GPT-5.5 / Evolução da experiência NOVA): Nova (UI) →
 * `ConversationService` → `AIProvider` → `IntentResolver` →
 * `ActionExecutor` → Banco de Dados.
 *
 * "Nenhuma tela pode acessar a IA diretamente" — `NovaWorkspace` chama só
 * `processTurn`/`confirmPending`/`cancelPending`, nunca
 * `getAIProvider()`/`MockAIProvider` diretamente. "Toda conversa deve
 * passar pelo MockAIProvider" — `getAIProvider()` hoje sempre devolve o
 * Mock (`AI_PROVIDER=mock`), então toda classificação de intenção passa
 * por ele.
 *
 * Ações sensíveis (dívida, ou despesa/receita de valor alto — ver
 * `isSensitiveIntent`) não executam na hora: ficam guardadas em `pending`
 * até o usuário confirmar (pelo botão na UI ou digitando algo como "sim")
 * ou cancelar. Uma instância desta classe guarda no máximo uma ação
 * pendente por vez — suficiente porque o usuário só conversa com um fluxo
 * por vez; uma nova mensagem que não seja claramente uma confirmação
 * descarta a pendência em vez de arriscar executar por engano.
 */
export class ConversationService {
  private pending: PendingTurn | undefined;

  async processTurn(text: string, ctx: NovaContext): Promise<NovaTurnResult> {
    if (this.pending) {
      const trimmed = text.trim();
      if (CONFIRM_PATTERN.test(trimmed)) {
        rememberTurn(text);
        return this.executePending(ctx);
      }
      // Não foi uma confirmação clara — descarta a pendência (cancelamento
      // explícito ou o usuário simplesmente mudou de assunto) e trata a
      // mensagem como um turno novo, nunca executando a ação antiga.
      this.pending = undefined;
      if (CANCEL_PATTERN.test(trimmed)) {
        rememberTurn(text);
        return { status: 'concluido', reply: CANCELLED_REPLY, checklist: [], results: [] };
      }
    }

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

    if (isSensitiveIntent(intent)) {
      this.pending = { intent, action: intentResolver.resolve(intent) };
      rememberTurn(text);
      return { status: 'aguardando_confirmacao', reply: buildConfirmationPreview(intent), checklist: [], results: [] };
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

  /** Chamado pelo botão "Confirmar" na UI — executa a ação guardada em `pending`. */
  async confirmPending(ctx: NovaContext): Promise<NovaTurnResult> {
    if (!this.pending) {
      return { status: 'concluido', reply: NO_PENDING_ACTION_REPLY, checklist: [], results: [] };
    }
    return this.executePending(ctx);
  }

  /** Chamado pelo botão "Cancelar" na UI — descarta `pending` sem executar nada. */
  cancelPending(): NovaTurnResult {
    this.pending = undefined;
    return { status: 'concluido', reply: CANCELLED_REPLY, checklist: [], results: [] };
  }

  private executePending(ctx: NovaContext): NovaTurnResult {
    const pending = this.pending;
    this.pending = undefined;
    if (!pending) {
      return { status: 'concluido', reply: NO_PENDING_ACTION_REPLY, checklist: [], results: [] };
    }

    const { intent, action } = pending;
    const checklist = buildPlan(intent).map((step) => step.label);
    const results = actionExecutor.execute(ctx, intent, action);
    const ok = results.length > 0 && results.every((result) => result.ok);

    return {
      status: ok ? 'concluido' : 'erro',
      reply: buildReply(intent, ok),
      checklist,
      results,
    };
  }
}
