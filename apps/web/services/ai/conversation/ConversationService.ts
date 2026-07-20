import {
  buildDailyCheckIn,
  buildDebtsSummary,
  buildPlan,
  buildReply,
  eventTypeForIntentKind,
  publish,
  recallFacts,
  rememberTurn,
  toReadOnlyContext,
} from '@/services/nova';
import type { NovaActionResult, NovaContext, NovaIntent, NovaPersona, NovaTurnResult } from '@/services/nova';
import { AI_PROVIDER, getAIProvider } from '../config';
import { AIProviderError, AI_ERROR_FRIENDLY_MESSAGES } from '../errors';
import type { AIProvider, ReasoningProvider, ReasoningTurn, ToolExecutionOutput } from '../interfaces';
import { buildOlderTurnsText, type ConversationTurnLike } from '../memory/condense-conversation';
import { MockAIProvider } from '../providers/MockAIProvider';
import type { AIConversationContext } from '../types';
import type { Action } from '../actions';
import { ActionExecutor } from './ActionExecutor';
import { buildBatchConfirmationPreview, buildConfirmationPreview, CANCEL_PATTERN, CONFIRM_PATTERN, isSensitiveIntent } from './confirmation';
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
 * CONTROL OS — Etapa 15 (LEGENDARY): persona padrão pra qualquer chamador
 * que ainda não passa uma (mesmo default de `buildSystemPrompt`) — nunca
 * uma segunda fonte de verdade, só o valor de fallback deste serviço.
 */
const DEFAULT_PERSONA: NovaPersona = 'nova';

/**
 * Fallback automático para `MockAIProvider` quando `OpenAIProvider` falha
 * (CONTROL OS — Etapa 4.5: Auditoria de Segurança — "fallback automático
 * para MockAIProvider quando configurado"). Desligado por padrão: sem essa
 * variável, uma falha da OpenAI continua devolvendo a mensagem amigável de
 * erro. Fica atrás de `NEXT_PUBLIC_` porque `ConversationService` roda no
 * cliente (`NovaWorkspace`), mesmo padrão de `services/ai/config.ts`.
 */
const FALLBACK_TO_MOCK_ON_ERROR = process.env.NEXT_PUBLIC_AI_FALLBACK_TO_MOCK === '1';

/**
 * Logs de execução de Tool no cliente (CONTROL OS — Etapa 5: "Registrar...
 * Tool utilizada, tempo da Tool... sem expor dados sensíveis"). A execução
 * de fato (`ActionExecutor`) roda no cliente, contra `useDataStore` — só
 * aqui dá pra medir "tempo da Tool"; "tempo da IA"/tokens ficam no log do
 * servidor (`app/api/ai/nova/route.ts`, `AI_DEBUG_LOGS`). Nunca loga valor,
 * descrição ou qualquer conteúdo — só o nome do tipo de ação e tempo.
 */
const CLIENT_DEBUG_LOGS = process.env.NEXT_PUBLIC_AI_DEBUG_LOGS === '1';

function logToolExecution(detail: Record<string, string | number>): void {
  if (!CLIENT_DEBUG_LOGS) return;
  // eslint-disable-next-line no-console -- log de desenvolvimento, desligado em produção por padrão.
  console.log('[nova-tools] tool_executed', detail);
}

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

/**
 * `AIProvider` (interface base, `chat`/`classifyIntent`/etc.) só ganha os
 * métodos de raciocínio (`converse`/`continueWithToolResults`) quando é de
 * fato um `OpenAIProvider` — checagem por VALOR (`AI_PROVIDER`, a mesma
 * fonte de verdade que `getAIProvider()` usa pra decidir qual classe
 * instanciar), nunca `instanceof`: mais barato, e consistente com o resto
 * do módulo (`services/ai/config.ts`).
 */
function isReasoningProvider(provider: AIProvider): provider is AIProvider & ReasoningProvider {
  return AI_PROVIDER === 'openai';
}

/** Um item de um lote de tool calls propostas — resolvido, pronto pra executar ou aguardar confirmação. */
interface PendingItem {
  intent: NovaIntent;
  action: Action | undefined;
  /** Só presente no caminho de raciocínio (Etapa 5) — correlaciona com a tool call original da OpenAI. */
  callId?: string;
}

interface PendingTurn {
  items: PendingItem[];
  /** Só presente no caminho de raciocínio — necessário pra `continueWithToolResults` depois da confirmação. */
  continuationToken?: string;
  /**
   * CONTROL OS — Etapa 15 (LEGENDARY): qual persona estava conduzindo o
   * turno que gerou esta pendência — usada só se a confirmação chegar sem
   * uma persona explícita (ver `confirmPending`). Trocar de persona nunca
   * limpa uma pendência; só decide qual identidade narra o resultado.
   */
  persona: NovaPersona;
}

/** Formata o resultado de uma tool call em texto pro modelo interpretar — nunca o `NovaActionResult` bruto (que carrega tipos internos). */
function formatResultForModel(results: NovaActionResult[]): string {
  if (results.length === 0) return 'Nenhuma alteração foi feita.';
  return results.map((result) => `${result.ok ? 'OK' : 'ERRO'}: ${result.action.label}${result.detail ? ` — ${result.detail}` : ''}`).join('\n');
}

/**
 * Ponto de entrada único da camada de IA (CONTROL OS — Preparação para
 * OpenAI GPT-5.5 / Evolução da experiência NOVA / Etapa 5: OpenAI GPT-5.5
 * como cérebro da NOVA).
 *
 * Dois caminhos, escolhidos por `AI_PROVIDER` (nunca pela UI):
 *   - `AI_PROVIDER=mock`: Nova → `ConversationService` → `MockAIProvider`
 *     (`classifyIntent`, determinístico) → `IntentResolver` →
 *     `ActionExecutor` → Banco de Dados. Fluxo intocado desde a Etapa 4.
 *   - `AI_PROVIDER=openai`: Nova → `ConversationService` → `OpenAIProvider`
 *     (`converse`/`continueWithToolResults`, Responses API) → Tool Calling
 *     → `IntentResolver` → `ActionExecutor` → Banco de Dados → Resultado →
 *     `OpenAIProvider` → Resposta final. "Em hipótese alguma a OpenAI
 *     poderá gravar dados diretamente" — a OpenAI só propõe tool calls
 *     (nome + argumentos); quem resolve (`IntentResolver`) e executa
 *     (`ActionExecutor`) é sempre este serviço, nunca o provider.
 *
 * "Nenhuma tela pode acessar a IA diretamente" — `NovaWorkspace` chama só
 * `processTurn`/`confirmPending`/`cancelPending`, nunca
 * `getAIProvider()`/`OpenAIProvider`/`MockAIProvider` diretamente.
 *
 * Ações sensíveis (dívida, ou despesa/receita de valor alto — ver
 * `isSensitiveIntent`) não executam na hora: ficam guardadas em
 * `pendingBySession` até o usuário confirmar (pelo botão na UI ou digitando
 * algo como "sim") ou cancelar. No caminho de raciocínio, um lote inteiro de
 * tool calls propostas no mesmo turno pausa se QUALQUER uma for sensível —
 * o usuário confirma ou cancela o lote inteiro, nunca uma ação sensível
 * escondida atrás de outras não sensíveis.
 *
 * CONTROL HUB — Fase 2 (auditoria de acoplamento com o navegador): este
 * serviço ainda depende do navegador em dois pontos — `ctx.actions`
 * (parâmetro `NovaContext`, vinculado ao `useDataStore`/Zustand) e as
 * chamadas diretas a `recallFacts`/`rememberTurn` acima (`services/nova/
 * memory`, que lê/escreve em `window.sessionStorage`). Nenhum canal
 * server-side do CONTROL HUB (`services/control-hub`) consegue chamar
 * `processTurn` hoje por causa disso — ver a análise completa em
 * `services/control-hub/nova-gateway.ts`, que documenta os dois pontos e
 * o caminho para resolvê-los numa fase futura.
 */
export class ConversationService {
  private pendingBySession = new Map<string, PendingTurn>();

  async processTurn(
    text: string,
    ctx: NovaContext,
    sessionId: string = DEFAULT_SESSION_ID,
    persona: NovaPersona = DEFAULT_PERSONA
  ): Promise<NovaTurnResult> {
    if (this.pendingBySession.has(sessionId)) {
      const trimmed = text.trim();
      if (CONFIRM_PATTERN.test(trimmed)) {
        rememberTurn(text, persona);
        return this.executePending(ctx, sessionId, persona);
      }
      // Não foi uma confirmação clara — descarta a pendência (cancelamento
      // explícito ou o usuário simplesmente mudou de assunto) e trata a
      // mensagem como um turno novo, nunca executando a ação antiga.
      this.pendingBySession.delete(sessionId);
      if (CANCEL_PATTERN.test(trimmed)) {
        rememberTurn(text, persona);
        return { status: 'concluido', reply: CANCELLED_REPLY, checklist: [], results: [] };
      }
    }

    if (AI_PROVIDER === 'openai') {
      return this.processTurnWithReasoning(text, ctx, sessionId, persona);
    }

    const provider = getAIProvider();
    const aiContext = toAIConversationContext(ctx);

    let intent: NovaIntent;
    try {
      intent = await provider.classifyIntent(text, aiContext);
    } catch (error) {
      // `MockAIProvider` nunca lança — só `OpenAIProvider` (rede real), e
      // este ramo só roda quando `AI_PROVIDER` NÃO é `'openai'` — na
      // prática, nunca lança de verdade. O fallback continua aqui por
      // simetria com `processTurnWithReasoning` e por segurança: nunca
      // deixa uma Promise rejeitar sem tratamento até a UI.
      const fallbackIntent = await this.tryMockFallback(text);
      if (!fallbackIntent) {
        rememberTurn(text, persona);
        const message = error instanceof AIProviderError ? error.friendlyMessage : AI_ERROR_FRIENDLY_MESSAGES.unavailable;
        return { status: 'erro', reply: message, checklist: [], results: [] };
      }
      intent = fallbackIntent;
    }

    return this.finishWithClassifiedIntent(intent, ctx, text, sessionId, persona);
  }

  /** Chamado pelo botão "Confirmar" na UI — executa o lote guardado em `pendingBySession`. */
  async confirmPending(
    ctx: NovaContext,
    sessionId: string = DEFAULT_SESSION_ID,
    persona: NovaPersona = DEFAULT_PERSONA
  ): Promise<NovaTurnResult> {
    if (!this.pendingBySession.has(sessionId)) {
      return { status: 'concluido', reply: NO_PENDING_ACTION_REPLY, checklist: [], results: [] };
    }
    return this.executePending(ctx, sessionId, persona);
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
   * Caminho de raciocínio (CONTROL OS — Etapa 5): manda a mensagem pra
   * `OpenAIProvider.converse`, que devolve OU uma resposta final pronta
   * (nenhuma tool call necessária — ex.: "Analise meus gastos", respondida
   * a partir do contexto já enviado) OU uma ou mais tool calls propostas.
   * Tool calls sensíveis pausam o lote inteiro pra confirmação; as demais
   * executam na hora e voltam pra OpenAI narrar o resultado
   * (`executeAndNarrate`).
   */
  private async processTurnWithReasoning(
    text: string,
    ctx: NovaContext,
    sessionId: string,
    persona: NovaPersona
  ): Promise<NovaTurnResult> {
    const provider = getAIProvider();
    if (!isReasoningProvider(provider)) {
      // Nunca alcançado em runtime — só chega aqui quando `AI_PROVIDER === 'openai'`, e só `OpenAIProvider` é instanciado nesse caso.
      rememberTurn(text, persona);
      return { status: 'erro', reply: AI_ERROR_FRIENDLY_MESSAGES.unavailable, checklist: [], results: [] };
    }

    const aiContext = toAIConversationContext(ctx);

    let turn: ReasoningTurn;
    try {
      turn = await provider.converse(text, aiContext, persona);
    } catch (error) {
      const fallbackIntent = await this.tryMockFallback(text);
      if (!fallbackIntent) {
        rememberTurn(text, persona);
        const message = error instanceof AIProviderError ? error.friendlyMessage : AI_ERROR_FRIENDLY_MESSAGES.unavailable;
        return { status: 'erro', reply: message, checklist: [], results: [] };
      }
      return this.finishWithClassifiedIntent(fallbackIntent, ctx, text, sessionId, persona);
    }

    if (turn.toolCalls.length === 0) {
      rememberTurn(text, persona);
      return { status: 'concluido', reply: turn.replyText ?? FALLBACK_REPLY, checklist: [], results: [] };
    }

    const items: PendingItem[] = turn.toolCalls.map((call) => ({
      callId: call.callId,
      intent: call.intent,
      action: intentResolver.resolve(call.intent),
    }));

    const anySensitive = items.some((item) => isSensitiveIntent(item.intent));
    if (anySensitive) {
      this.pendingBySession.set(sessionId, { items, continuationToken: turn.continuationToken, persona });
      rememberTurn(text, persona);
      return {
        status: 'aguardando_confirmacao',
        reply: buildBatchConfirmationPreview(items.map((item) => item.intent)),
        checklist: [],
        results: [],
      };
    }

    rememberTurn(text, persona);
    return this.executeAndNarrate(ctx, items, turn.continuationToken, sessionId, persona);
  }

  /**
   * Trata uma intent já classificada (`MockAIProvider.classifyIntent`, ou o
   * fallback determinístico depois de uma falha da OpenAI) — compartilhado
   * pelos dois pontos de entrada que produzem uma intent única em vez de um
   * lote de tool calls. Consultas (`consultar_dividas`/`consultar_dia`) e
   * `desconhecido` respondem direto, sem passar por `IntentResolver`/
   * `ActionExecutor` — igual ao comportamento desde a Etapa 3.
   */
  private async finishWithClassifiedIntent(
    intent: NovaIntent,
    ctx: NovaContext,
    text: string,
    sessionId: string,
    persona: NovaPersona
  ): Promise<NovaTurnResult> {
    if (intent.kind === 'desconhecido') {
      rememberTurn(text, persona);
      return { status: 'concluido', reply: FALLBACK_REPLY, checklist: [], results: [] };
    }

    if (intent.kind === 'consultar_dividas') {
      rememberTurn(text, persona);
      return { status: 'concluido', reply: buildDebtsSummary(ctx.debts), checklist: [], results: [] };
    }

    if (intent.kind === 'consultar_dia') {
      rememberTurn(text, persona);
      const reply = buildDailyCheckIn(ctx.missions, ctx.agendaEvents, ctx.financeEntries, ctx.habits, ctx.userName);
      return { status: 'concluido', reply, checklist: [], results: [] };
    }

    if (isSensitiveIntent(intent)) {
      this.pendingBySession.set(sessionId, { items: [{ intent, action: intentResolver.resolve(intent) }], persona });
      rememberTurn(text, persona);
      return { status: 'aguardando_confirmacao', reply: buildConfirmationPreview(intent), checklist: [], results: [] };
    }

    rememberTurn(text, persona);
    return this.executeAndNarrate(ctx, [{ intent, action: intentResolver.resolve(intent) }], undefined, sessionId, persona);
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

  private async executePending(ctx: NovaContext, sessionId: string, persona: NovaPersona): Promise<NovaTurnResult> {
    const pending = this.pendingBySession.get(sessionId);
    this.pendingBySession.delete(sessionId);
    if (!pending) {
      return { status: 'concluido', reply: NO_PENDING_ACTION_REPLY, checklist: [], results: [] };
    }
    // A persona ATUAL (quem confirmou agora) narra o resultado — não a que
    // estava ativa quando a pendência nasceu (`pending.persona` existe só
    // pra futura auditoria/depuração, nunca é o que decide aqui). Trocar de
    // persona no meio de uma confirmação é exatamente o caso "continuidade
    // sem perder histórico" do spec da Etapa 15.
    return this.executeAndNarrate(ctx, pending.items, pending.continuationToken, sessionId, persona);
  }

  /**
   * Último elo antes da resposta: executa cada item via `ActionExecutor`
   * (nunca a IA — "em hipótese alguma a OpenAI poderá gravar dados
   * diretamente") e formula a resposta final.
   *
   * Sem `continuationToken` (caminho Mock, ou fallback determinístico): a
   * resposta vem do template de sempre (`buildReply`), comportamento
   * idêntico a antes da Etapa 5. Com `continuationToken` (caminho de
   * raciocínio real): devolve os resultados pra OpenAI narrar
   * (`continueWithToolResults`) — "OpenAI monta resposta" — e usa o
   * template só como rede de segurança se essa segunda chamada falhar (a
   * ação já foi executada; o usuário nunca fica sem saber o que aconteceu).
   *
   * Etapa 7 — IA-Native (Event Bus): depois de executar tudo, publica um
   * `NovaEvent` pra cada item que escreveu com sucesso — este é o único
   * lugar do sistema que chama `publish`, porque é o único lugar por onde
   * toda escrita real (Mock, OpenAI, ou confirmação de ação sensível)
   * necessariamente passa (ver `ActionExecutor.execute` acima). Nenhuma
   * `Action` sabe que este barramento existe.
   */
  private async executeAndNarrate(
    ctx: NovaContext,
    items: PendingItem[],
    continuationToken: string | undefined,
    sessionId: string,
    persona: NovaPersona
  ): Promise<NovaTurnResult> {
    const perItemResults = items.map((item) => {
      const toolStartedAt = Date.now();
      const results = actionExecutor.execute(ctx, item.intent, item.action);
      logToolExecution({ tool: item.intent.kind, elapsedMs: Date.now() - toolStartedAt, ok: results.every((result) => result.ok) ? 1 : 0 });
      return { callId: item.callId, intent: item.intent, results };
    });

    // Snapshot único, calculado depois de todas as escritas do turno — cada
    // evento publicado abaixo carrega o mesmo estado real e já atualizado,
    // nunca um instantâneo parcial de um item anterior do mesmo lote.
    const readOnlyCtx = toReadOnlyContext(ctx);
    const occurredAt = new Date().toISOString();
    for (const entry of perItemResults) {
      const eventType = eventTypeForIntentKind(entry.intent.kind);
      const succeeded = entry.results.length > 0 && entry.results.every((result) => result.ok);
      if (!eventType || !succeeded) continue;
      const [firstResult] = entry.results;
      publish({ type: eventType, occurredAt, summary: firstResult?.detail ?? entry.intent.raw, sessionId, context: readOnlyCtx });
    }

    const checklist = items.flatMap((item) => buildPlan(item.intent).map((step) => step.label));
    const results = perItemResults.flatMap((entry) => entry.results);
    const ok = results.length > 0 && results.every((result) => result.ok);
    const [firstItem] = items;
    const templateReply = firstItem ? buildReply(firstItem.intent, ok) : FALLBACK_REPLY;

    const provider = getAIProvider();
    if (!isReasoningProvider(provider) || !continuationToken) {
      return { status: ok ? 'concluido' : 'erro', reply: templateReply, checklist, results };
    }

    const aiContext = toAIConversationContext(ctx);
    const outputs: ToolExecutionOutput[] = perItemResults.map((entry, index) => ({
      callId: entry.callId ?? `item-${index}`,
      output: formatResultForModel(entry.results),
    }));

    try {
      const final = await provider.continueWithToolResults(continuationToken, outputs, aiContext, persona);
      return { status: ok ? 'concluido' : 'erro', reply: final.replyText ?? templateReply, checklist, results };
    } catch {
      // A ação já foi executada de verdade — só a narração final falhou.
      // Nunca esconde isso do usuário: devolve o template em vez de um erro.
      return { status: ok ? 'concluido' : 'erro', reply: templateReply, checklist, results };
    }
  }
}
