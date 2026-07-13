import { buildDailyCheckIn, buildDebtsSummary, buildPlan, buildReply, recallFacts, rememberTurn } from '@/services/nova';
import type { NovaContext, NovaIntent, NovaTurnResult } from '@/services/nova';
import { getAIProvider } from '../config';
import { AIProviderError, AI_ERROR_FRIENDLY_MESSAGES } from '../errors';
import { buildOlderTurnsText, type ConversationTurnLike } from '../memory/condense-conversation';
import { MockAIProvider } from '../providers/MockAIProvider';
import type { AIConversationContext } from '../types';
import type { Action } from '../actions';
import { ActionExecutor } from './ActionExecutor';
import { buildConfirmationPreview, CANCEL_PATTERN, CONFIRM_PATTERN, isSensitiveIntent } from './confirmation';
import { IntentResolver } from './IntentResolver';

const intentResolver = new IntentResolver();
const actionExecutor = new ActionExecutor();
const mockFallbackProvider = new MockAIProvider();

/**
 * Sessão usada quando quem chama não passa uma (`NovaWorkspace` hoje —
 * usuário único, cliente). Existe pra `pendingBySession` já nascer pronto
 * pra múltiplas sessões concorrentes (CONTROL OS — Etapa 4.5: Auditoria —
 * "será possível integrar WhatsApp/Telegram/etc. sem refatoração grande?")
 * sem exigir que o único chamador atual mude nada.
 */
const DEFAULT_SESSION_ID = 'default';

/**
 * Fallback automático para `MockAIProvider` quando `OpenAIProvider` falha
 * (CONTROL OS — Etapa 4.5: Auditoria de Segurança — "fallback automático
 * para MockAIProvider quando configurado"). Desligado por padrão: sem essa
 * variável, uma falha da OpenAI continua devolvendo a mensagem amigável de
 * erro (comportamento inalterado desde a Etapa 4). Fica atrás de
 * `NEXT_PUBLIC_` porque `ConversationService` roda no cliente
 * (`NovaWorkspace`), mesmo padrão de `services/ai/config.ts`.
 */
const FALLBACK_TO_MOCK_ON_ERROR = process.env.NEXT_PUBLIC_AI_FALLBACK_TO_MOCK === '1';

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

/**
 * Recorta de `NovaContext` só o que o `AIProvider` pode ler — nunca
 * `actions`. Estendido na Etapa 4 com todos os domínios do CONTROL OS
 * (trips/documents/assets/notes/preferences), pra um provedor real ter
 * cobertura completa sem precisar de acesso direto ao banco.
 */
function toAIConversationContext(ctx: NovaContext): AIConversationContext {
  return {
    userName: ctx.userName,
    debts: ctx.debts,
    missions: ctx.missions,
    agendaEvents: ctx.agendaEvents,
    financeEntries: ctx.financeEntries,
    habits: ctx.habits,
    trips: ctx.trips,
    documents: ctx.documents,
    assets: ctx.assets,
    notes: ctx.notes,
    preferences: recallFacts('preferencia').map((fact) => fact.text),
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
 * `isSensitiveIntent`) não executam na hora: ficam guardadas em
 * `pendingBySession` até o usuário confirmar (pelo botão na UI ou digitando
 * algo como "sim") ou cancelar — no máximo uma ação pendente por sessão;
 * uma nova mensagem que não seja claramente uma confirmação descarta a
 * pendência daquela sessão em vez de arriscar executar por engano.
 *
 * Estado de pendência é mantido POR `sessionId` (nunca por instância) desde
 * a auditoria da Etapa 4.5: `NovaWorkspace` usa uma única instância
 * compartilhada deste serviço (ver comentário lá) e, antes desta mudança,
 * um `this.pending` único misturaria a confirmação pendente de conversas
 * diferentes se este mesmo serviço um dia atender mais de um usuário ao
 * mesmo tempo (ex.: `services/channels/whatsapp`, hoje um stub desconectado
 * de qualquer webhook, mas desenhado pra reaproveitar esta classe sem
 * modificação quando for conectado de verdade). Quem chama sem informar
 * `sessionId` (todo código atual) continua usando `DEFAULT_SESSION_ID` — o
 * comportamento de hoje, para um usuário só, não muda em nada.
 */
export class ConversationService {
  private pendingBySession = new Map<string, PendingTurn>();

  async processTurn(text: string, ctx: NovaContext, sessionId: string = DEFAULT_SESSION_ID): Promise<NovaTurnResult> {
    if (this.pendingBySession.has(sessionId)) {
      const trimmed = text.trim();
      if (CONFIRM_PATTERN.test(trimmed)) {
        rememberTurn(text);
        return this.executePending(ctx, sessionId);
      }
      // Não foi uma confirmação clara — descarta a pendência (cancelamento
      // explícito ou o usuário simplesmente mudou de assunto) e trata a
      // mensagem como um turno novo, nunca executando a ação antiga.
      this.pendingBySession.delete(sessionId);
      if (CANCEL_PATTERN.test(trimmed)) {
        rememberTurn(text);
        return { status: 'concluido', reply: CANCELLED_REPLY, checklist: [], results: [] };
      }
    }

    const provider = getAIProvider();
    const aiContext = toAIConversationContext(ctx);

    let intent: NovaIntent;
    try {
      intent = await provider.classifyIntent(text, aiContext);
    } catch (error) {
      // `MockAIProvider` nunca lança — só `OpenAIProvider` (rede real). Se
      // o fallback estiver ligado (`NEXT_PUBLIC_AI_FALLBACK_TO_MOCK=1`),
      // tenta o Mock antes de desistir — mesmo padrão determinístico que já
      // roda em produção quando `AI_PROVIDER=mock`. Sem o fallback (padrão),
      // ou se o próprio Mock falhar (não deveria, mas nunca deixa uma
      // Promise rejeitar sem tratamento até a UI), devolve a mensagem
      // amigável de erro.
      const fallbackIntent = await this.tryMockFallback(text);
      if (!fallbackIntent) {
        rememberTurn(text);
        const message = error instanceof AIProviderError ? error.friendlyMessage : AI_ERROR_FRIENDLY_MESSAGES.unavailable;
        return { status: 'erro', reply: message, checklist: [], results: [] };
      }
      intent = fallbackIntent;
    }

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
      this.pendingBySession.set(sessionId, { intent, action: intentResolver.resolve(intent) });
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

  /** Chamado pelo botão "Confirmar" na UI — executa a ação guardada em `pendingBySession`. */
  async confirmPending(ctx: NovaContext, sessionId: string = DEFAULT_SESSION_ID): Promise<NovaTurnResult> {
    if (!this.pendingBySession.has(sessionId)) {
      return { status: 'concluido', reply: NO_PENDING_ACTION_REPLY, checklist: [], results: [] };
    }
    return this.executePending(ctx, sessionId);
  }

  /** Chamado pelo botão "Cancelar" na UI — descarta a pendência da sessão sem executar nada. */
  cancelPending(sessionId: string = DEFAULT_SESSION_ID): NovaTurnResult {
    this.pendingBySession.delete(sessionId);
    return { status: 'concluido', reply: CANCELLED_REPLY, checklist: [], results: [] };
  }

  /**
   * Resumo automático de conversa (CONTROL OS — Etapa 4) — chamado pela UI
   * quando o histórico cresce demais (ver `shouldCondense`,
   * `services/ai/memory/condense-conversation.ts`). Único ponto de acesso
   * ao `AIProvider` para isso — a UI nunca chama `getAIProvider()` direto,
   * mesmo princípio de `processTurn`.
   */
  async summarizeOlderTurns(turns: ConversationTurnLike[]): Promise<string> {
    const provider = getAIProvider();
    return provider.summarize(buildOlderTurnsText(turns));
  }

  /**
   * Tenta classificar com `MockAIProvider` depois de uma falha do provedor
   * ativo — só faz sentido, e só é chamada, quando o fallback está ligado
   * (ver `FALLBACK_TO_MOCK_ON_ERROR`). `MockAIProvider.classifyIntent` não
   * usa contexto (é regex puro sobre o texto — só `generateResponse` olha
   * `context`), por isso só `text` é passado aqui. `MockAIProvider` é
   * determinístico e não faz rede, mas o `try` continua por segurança:
   * nunca deixa uma falha inesperada do fallback também escapar sem
   * tratamento.
   */
  private async tryMockFallback(text: string): Promise<NovaIntent | undefined> {
    if (!FALLBACK_TO_MOCK_ON_ERROR) return undefined;
    try {
      return await mockFallbackProvider.classifyIntent(text);
    } catch {
      return undefined;
    }
  }

  private executePending(ctx: NovaContext, sessionId: string): NovaTurnResult {
    const pending = this.pendingBySession.get(sessionId);
    this.pendingBySession.delete(sessionId);
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
