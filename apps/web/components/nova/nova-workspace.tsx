'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  CalendarClock,
  Flag,
  Plane,
  Receipt,
  Rocket,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { NovaInput, type NovaInputSource } from '@/components/nova/nova-input';
import { NovaConversation } from '@/components/nova/nova-conversation';
import { NovaPersonaSwitch } from '@/components/nova/nova-persona-switch';
import type { ConversationMessage, ConversationMessageAction, ConversationMessageStatus } from '@/components/nova/nova-message-bubble';
import type { NovaThinkingStatus } from '@/components/nova/nova-thinking';
import type { NovaOrbStatus } from '@/components/nova/nova-orb';
import { QuickAction } from '@/components/ui/quick-action';
import { IntelligentPanel } from '@/components/home/intelligent-panel';
import { NovaHeroStage } from '@/components/nova/nova-hero-stage';
import { NovaCommandOverview } from '@/components/nova/nova-command-overview';
import { LegendaryCommandOverview } from '@/components/nova/legendary-command-overview';
import { conversationService } from '@/services/ai';
import { buildProactiveOpening, generateRecommendations, toReadOnlyContext } from '@/services/nova';
import type { NovaPersona, NovaRecommendationCategory, NovaStatus } from '@/services/nova';
import { getVoiceProvider } from '@/services/voice';
import { useAppStore } from '@/lib/store';
import { useNovaContext } from '@/lib/use-nova-context';
import { transitionOut, transitionSpring } from '@/lib/motion';
import { formatCurrency } from '@/lib/utils';
import { pollDocumentAnalysisProgress } from '@/lib/use-document-analysis-progress';
import { progressStageLabel } from '@/lib/document-analysis-progress';
import {
  NovaConversationApiError,
  novaConversationApiClient,
  type NovaConversationPersonaDto,
} from '@/lib/nova-conversations/nova-conversation-api-client';
import {
  buildPersistTurnRequest,
  buildProcessMessageRequest,
  isOperationCurrent,
  orchestratorMessagesToTurn,
  type PendingConversationTurn,
  type PendingOrchestratorTurn,
} from '@/lib/nova-conversations/nova-conversation-workspace-model';
import { routeControlledOrchestratorTurn } from '@/lib/nova-conversations/nova-controlled-orchestrator-rollout';

// CONTROL OS — HERO SCENE REBOOT: qual tecnologia renderiza o Hero Object
// agora depende da persona — decisão isolada em `NovaHeroStage`. NOVA usa
// um anel flat em CSS (`nova-ring-object.tsx`, réplica do mockup aprovado
// pelo usuário); LEGENDARY continua no Hero Scene em React Three Fiber
// (`nova-hero-scene.tsx`, Etapa 17), intocado. `NovaOrb` (Canvas 2D)
// continua existindo à parte, usada por `NovaFloatingLauncher` e o painel
// flutuante inline.

// Sugestões genéricas — só aparecem quando ainda não há nenhuma recomendação
// real (usuário novo, sem dados suficientes ainda). Nunca a fonte principal
// de sugestão a partir da Etapa 9 (ver `SUGGESTION_ICON_BY_CATEGORY` abaixo).
const QUICK_ACTIONS = [
  { icon: Target, label: 'Organize meu dia' },
  { icon: Activity, label: 'Como está minha empresa?' },
  { icon: Wallet, label: 'Gastei dinheiro' },
  { icon: Flag, label: 'Criar uma meta' },
  { icon: CalendarClock, label: 'Ver meus compromissos' },
] as const;

// CONTROL OS — Etapa 9: "Nunca sugestões aleatórias. Sempre baseadas nos
// dados." Cada categoria do Recommendation Engine (Etapa 7,
// `generateRecommendations`) vira uma pergunta curta e clicável — o ícone
// reaproveita os 5 já importados acima (nenhum ícone novo).
const SUGGESTION_ICON_BY_CATEGORY: Record<NovaRecommendationCategory, LucideIcon> = {
  reduzir_gastos: Wallet,
  revisar_gastos: Wallet,
  concluir_habitos: Activity,
  reorganizar_agenda: CalendarClock,
  antecipar_metas: Flag,
  priorizar_tarefas: Target,
  // CONTROL OS — Etapa 13 (NOVA Proativa).
  gasto_semanal_alto: TrendingUp,
  retomar_registro: Receipt,
  reconhecer_consistencia: Trophy,
  revisar_fluxo_caixa: Wallet,
  acompanhar_meta: Flag,
  acompanhar_projeto: Rocket,
  viagem_proxima: Plane,
};

const SUGGESTION_LABEL_BY_CATEGORY: Record<NovaRecommendationCategory, string> = {
  reduzir_gastos: 'Quer revisar seus gastos deste mês?',
  revisar_gastos: 'Quer revisar essa categoria de gasto?',
  concluir_habitos: 'Quer ver seus hábitos pendentes?',
  reorganizar_agenda: 'Quer reorganizar sua agenda?',
  antecipar_metas: 'Quer antecipar os próximos passos da sua meta?',
  priorizar_tarefas: 'Quer priorizar o que está em risco?',
  // CONTROL OS — Etapa 13 (NOVA Proativa).
  gasto_semanal_alto: 'Quer ver seu gasto desta semana?',
  retomar_registro: 'Quer registrar uma despesa?',
  reconhecer_consistencia: 'Ver minhas missões concluídas',
  revisar_fluxo_caixa: 'Quer revisar meu fluxo de caixa?',
  acompanhar_meta: 'Ver andamento da minha meta',
  acompanhar_projeto: 'Ver andamento do meu projeto',
  viagem_proxima: 'Revisar planejamento da viagem',
};

// Nenhuma tela acessa a IA diretamente (CONTROL OS — Preparação para OpenAI
// GPT-5.5): o único jeito de conversar com a NOVA é através do
// `ConversationService`, que por sua vez decide o `AIProvider` internamente
// (`services/ai/config.ts`). Desde a Etapa 8, `conversationService` é o
// singleton compartilhado exportado por `services/ai` — não uma instância
// própria deste componente — porque o Modo Conversa por voz é um segundo
// consumidor que precisa enxergar a mesma confirmação de ação sensível
// pendente (`pendingBySession`) que a conversa por texto.

// CONTROL OS — Etapa 11: "nunca deixar a tela parada" — antes, a UI esperava
// esses dois delays em SEQUÊNCIA, SEM iniciar a chamada real (1200ms de
// espera artificial pura antes até de perguntar pra OpenAI). Agora
// `conversationService.processTurn` começa em 0ms; `EXECUTING_SWITCH_MS` só
// decide quando a legenda da bolha troca de "Pensando" pra "Executando" —
// puramente cosmético, cancelado assim que a resposta real chega.
const EXECUTING_SWITCH_MS = 700;

/**
 * Pergunta de cada campo do wizard de coleta em chat (Fase E). Nível de
 * módulo (não dentro do componente) de propósito: é um valor fixo, sem
 * dependência de props/estado — mantê-lo aqui dá a ele identidade estável
 * entre renders, então `presentFieldQuestion` (useCallback) pode
 * referenciá-lo sem precisar entrar no array de dependências (e sem o
 * warning de `react-hooks/exhaustive-deps` que uma constante recriada a
 * cada render dentro do componente geraria).
 */
const FIELD_QUESTIONS: Record<'accountId' | 'categoryId', string> = {
  accountId: 'Qual conta usar?',
  categoryId: 'Qual categoria usar?',
};

let messageIdCounter = 0;

/** Gera um id sequencial estável para mensagens da conversa (sem `crypto`). */
function nextMessageId(prefix: string): string {
  messageIdCounter += 1;
  return `${prefix}_${messageIdCounter}`;
}

function nextClientTurnId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `web-turn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * `NovaStatus` (camada de serviço) → `ConversationMessageStatus` (camada de
 * UI) — dois vocabulários próximos, mas não idênticos:
 * `'pensando'`/`'executando'` nem chegam aqui (só aparecem via
 * `isThinking`/`thinkingStatus`, nunca num `NovaTurnResult` já concluído).
 */
function resultStatusToMessageStatus(status: NovaStatus): ConversationMessageStatus {
  if (status === 'erro') return 'error';
  if (status === 'aguardando_confirmacao') return 'pending_confirmation';
  return 'success';
}

export interface NovaWorkspaceProps {
  /** Mostra o Painel Inteligente (métricas agregadas) abaixo da conversa. Padrão: escondido — a Home prioriza a esfera, limpa. */
  showIntelligentPanel?: boolean;
  /**
   * `'inline'` (padrão): fluxo normal, usado dentro do `NovaFloatingPanel`
   * (um modal, já com seu próprio scroll). `'docked'`: layout de tela
   * inteira com o campo da NOVA fixo no rodapé e o resto rolando por trás
   * — usado só na Home (`/nova`), estilo inspirado em referência visual
   * enviada pelo usuário.
   */
  variant?: 'inline' | 'docked';
  /** Só usado no modo `docked`, e só antes da primeira mensagem — some assim que a conversa começa, para deixar a esfera como protagonista. */
  topContent?: React.ReactNode;
  /**
   * Só usado no modo `docked`, e só antes da primeira mensagem (mesma regra
   * de `topContent`). Renderizado logo abaixo da esfera — o espaço onde o
   * spec da Etapa 11 pede "resumo financeiro, resumo da agenda, resumo dos
   * hábitos" depois das ações rápidas: como o campo de entrada é fixo no
   * rodapé (nada pode vir depois dele na ordem real do DOM), este é o lugar
   * que preserva a prioridade conceitual do spec sem quebrar o layout.
   */
  belowOrbContent?: React.ReactNode;
  /**
   * CONTROL OS — NOVA e LEGENDARY viraram dois ambientes/rotas fixos
   * (`/nova` e `/legendary`), não mais um seletor dentro da mesma tela —
   * "o usuário deve sentir que navegou para outro ambiente do sistema, e
   * não apenas trocou de modelo de conversa". Quando esta prop existe, o
   * workspace força `activePersona` pra este valor (nunca lê o que já
   * estava no store) e NÃO renderiza o `NovaPersonaSwitch` — trocar de
   * persona agora é navegar pra outra rota (botão flutuante global, ver
   * `NovaFloatingLauncher`), nunca mutar estado local na mesma tela.
   * Omitida (padrão): comportamento antigo, inalterado — é o caso do
   * `NovaFloatingPanel` (`variant="inline"`), que continua sendo uma
   * conversa só, com seletor de persona in-place.
   */
  lockedPersona?: NovaPersona;
  /**
   * No dashboard, a conversa aparece antes do campo para manter o histórico
   * como contexto visual e o compositor como a ação final da tela. O painel
   * flutuante preserva a ordem antiga por padrão.
   */
  conversationFirst?: boolean;
  /** Oculta os atalhos abaixo do compositor em superfícies mais enxutas. */
  showQuickActions?: boolean;
  /**
   * Modo usado na Visão geral: mantém o histórico em uma área própria com
   * rolagem, enquanto o campo de mensagem fica sempre acessível no rodapé do
   * card. Assim, uma conversa longa nunca empurra o dashboard para baixo.
   */
  containedConversation?: boolean;
}

/**
 * NovaWorkspace — orquestra o Modo de Conversa (Nova Experience — Fase 2),
 * executando ações reais contra `useDataStore` via `processNovaTurn`
 * (CONTROL OS 3.0/Etapa 3) em vez de um gerador de respostas mockado local.
 *
 * A Home (`variant="docked"`) é propositalmente limpa — objetivo declarado
 * pelo usuário: "só a bola no meio", sem painéis, sensação de estar
 * conversando com alguém. O Hero Object (`NovaHeroScene`, CONTROL OS —
 * Etapa 17: React Three Fiber) fica sempre visível (não some depois da
 * primeira mensagem) e cresce (`scale`) conforme o estado da conversa —
 * pensando/executando —, como se estivesse reagindo. Reaproveitado também
 * pelo `NovaFloatingPanel` (`variant="inline"`, sem esfera — painel pequeno
 * demais para o efeito valer a pena).
 *
 * Mensagens da conversa vivem no `useAppStore` (`novaMessages`) — sobrevivem
 * a fechar/reabrir o painel flutuante, ver `lib/store.ts`. O estado da Nova
 * (pensando/executando) continua local (`useState`), próprio de cada
 * montagem. "Primeiro faz. Depois responde." — o plano/checklist e a
 * execução real sempre rodam antes da resposta em texto aparecer. Ações
 * sensíveis (dívida, valor alto) param em `'aguardando_confirmacao'` até o
 * usuário confirmar ou cancelar pelos botões na última mensagem.
 */
export function NovaWorkspace({
  showIntelligentPanel = false,
  variant = 'inline',
  topContent,
  belowOrbContent,
  lockedPersona,
  conversationFirst = false,
  showQuickActions = true,
  containedConversation = false,
}: NovaWorkspaceProps) {
  // Vive no `useAppStore` (não mais `useState` local) — sobrevive a
  // fechar/reabrir o painel flutuante. Ver comentário em `lib/store.ts`.
  const addNovaMessage = useAppStore((state) => state.addNovaMessage);
  const updateNovaMessage = useAppStore((state) => state.updateNovaMessage);
  const setNovaConversationCache = useAppStore((state) => state.setNovaConversationCache);
  const hydrateNovaConversationMessages = useAppStore((state) => state.hydrateNovaConversationMessages);
  const prependNovaConversationMessages = useAppStore((state) => state.prependNovaConversationMessages);
  const reconcileNovaConversationTurn = useAppStore((state) => state.reconcileNovaConversationTurn);
  const markNovaConversationTurnUnsynced = useAppStore((state) => state.markNovaConversationTurnUnsynced);
  const resetNovaConversationCache = useAppStore((state) => state.resetNovaConversationCache);
  const clearAllNovaConversationCaches = useAppStore((state) => state.clearAllNovaConversationCaches);
  // CONTROL OS — Etapa 15 (LEGENDARY): qual identidade conduz o PRÓXIMO
  // turno — vive no `useAppStore` (não `useState` local) pelo mesmo motivo
  // de `novaMessagesByPersona`: sobrevive a fechar/reabrir o painel
  // flutuante e a navegar entre páginas, sem duplicar estado entre a Home e
  // o painel.
  const activePersona = useAppStore((state) => state.activePersona);
  const setActivePersona = useAppStore((state) => state.setActivePersona);

  // `lockedPersona` (rotas /nova e /legendary): força o store pro valor do
  // AMBIENTE atual assim que a página monta — nunca herda o que sobrou de
  // uma navegação anterior. Efeito, não cálculo direto no render, porque
  // `setActivePersona` escreve no store global (`useAppStore`), compartilhado
  // com o `NovaFloatingPanel` em qualquer outra página.
  React.useEffect(() => {
    if (lockedPersona && activePersona !== lockedPersona) {
      setActivePersona(lockedPersona);
    }
  }, [lockedPersona, activePersona, setActivePersona]);

  // CONTROL OS — "separação completa entre NOVA e LEGENDARY": em rotas com
  // `lockedPersona` (`/nova`, `/legendary`), o efeito acima só sincroniza
  // `activePersona` DEPOIS do primeiro render — sem isto, o primeiro quadro
  // de `/legendary` ainda leria o balde/placeholder/identidade da NOVA por
  // um instante (ou pior, da persona que estava ativa antes da navegação).
  // `effectivePersona` é a persona "de verdade" desta tela AGORA, conhecida
  // de forma síncrona (é uma prop, não estado assíncrono) — usada em todo
  // lugar que decide QUAL sessão mostrar (mensagens, placeholder, contexto
  // enviado à IA), nunca `activePersona` sozinha.
  const effectivePersona = lockedPersona ?? activePersona;
  const messages = useAppStore((state) => state.novaMessagesByPersona[effectivePersona]);
  const conversationCache = useAppStore((state) => state.novaConversationByPersona[effectivePersona]);
  // Mesmo com um histórico salvo, cada entrada em /nova ou /legendary começa
  // pela visão própria do ambiente. O histórico continua disponível, sem ser
  // apagado, e a conversa volta ao primeiro envio ou pelo botão abaixo.
  const [showCommandOverview, setShowCommandOverview] = React.useState(Boolean(lockedPersona));

  React.useEffect(() => {
    if (variant === 'docked' && lockedPersona) setShowCommandOverview(true);
  }, [variant, lockedPersona]);

  // CONTROL OS — "separação completa entre NOVA e LEGENDARY": antes, todo
  // turno de texto usava a sessão padrão fixa de `ConversationService`
  // (`sessionId` nunca passado por aqui) — uma ação sensível pendente de
  // confirmação na NOVA ficava visível/confirmável até de dentro da
  // LEGENDARY (mesmo `pendingBySession`). Uma sessão por persona isola isso
  // também no nível de confirmação, não só de histórico visual.
  const conversationId = conversationCache.conversationId;
  const isThinking = conversationCache.isThinking;
  const thinkingStatus: NovaThinkingStatus = conversationCache.thinkingStatus;
  // CONTROL OS — Etapa 11C: campo de conversa unificado — o microfone
  // inline do `NovaInput` avisa aqui quando está capturando, e a resposta a
  // um turno iniciado por voz é falada em voz alta (ver `handleSend`). Nem
  // um nem outro existiam antes desta etapa; `isThinking`/`thinkingStatus`
  // continuam intactos, controlando só a parte "pensando/executando".
  const [isListening, setIsListening] = React.useState(false);
  const [isSpeakingReply, setIsSpeakingReply] = React.useState(false);
  const [speechPulse, setSpeechPulse] = React.useState(0);

  // CONTROL OS — teste de uso real (30 min como usuária pagante): a cada
  // resposta da NOVA a tela ficava parada na posição anterior — a mensagem
  // nova nascia escondida atrás do campo fixo do rodapé, e era preciso
  // rolar manualmente pra lê-la. Só existe no `variant="docked"` (a Home) —
  // é o único caso em que este componente é dono do próprio container de
  // rolagem; o `variant="inline"` (`NovaFloatingPanel`) rola por conta
  // própria, ver o mesmo tratamento lá.
  const dockedScrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = dockedScrollRef.current;
    if (!el) return;
    if (showCommandOverview) {
      el.scrollTo({ top: 0 });
      return;
    }
    if (conversationCache.lastMessageMutation !== 'prepend') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isThinking, showCommandOverview, conversationCache.lastMessageMutation]);

  // Nunca deixa uma fala em andamento presa em segundo plano se este
  // workspace desmontar (ex.: usuário navega pra outra tela) no meio de uma
  // resposta falada.
  React.useEffect(() => {
    return () => {
      getVoiceProvider().cancel();
    };
  }, []);

  // CONTROL OS — Etapa 8: extraído para `useNovaContext` (`lib/`) — o novo
  // Modo Conversa por voz (`NovaVoiceOverlay`) precisa do mesmo `NovaContext`
  // real, e duplicar esta montagem em dois lugares arriscaria os dois
  // divergirem com o tempo.
  const novaContext = useNovaContext();

  const hydrateActiveConversation = React.useCallback(async (persona: NovaPersona, force = false): Promise<void> => {
    const current = useAppStore.getState().novaConversationByPersona[persona];
    if (!force && (current.hydrationStatus === 'loading' || current.hydrationStatus === 'ready')) return;

    const requestGeneration = current.requestGeneration + 1;
    setNovaConversationCache(persona, {
      hydrationStatus: 'loading',
      requestGeneration,
      error: null,
    });

    try {
      const serverPersona: NovaConversationPersonaDto = persona === 'nova' ? 'NOVA' : 'LEGENDARY';
      const conversation = await novaConversationApiClient.getOrCreateActive(serverPersona);
      const page = await novaConversationApiClient.listMessages(conversation.id, undefined, 100);
      const latest = useAppStore.getState().novaConversationByPersona[persona];
      if (latest.requestGeneration !== requestGeneration) return;

      hydrateNovaConversationMessages(persona, page.items);
      setNovaConversationCache(persona, {
        conversationId: conversation.id,
        hydrationStatus: 'ready',
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        error: null,
        isCreatingConversation: false,
      });
    } catch (cause) {
      if (cause instanceof NovaConversationApiError && cause.status === 401) {
        clearAllNovaConversationCaches();
        return;
      }
      const latest = useAppStore.getState().novaConversationByPersona[persona];
      if (latest.requestGeneration !== requestGeneration) return;
      setNovaConversationCache(persona, {
        hydrationStatus: 'error',
        error: cause instanceof NovaConversationApiError ? cause.message : 'Não foi possível carregar esta conversa.',
        isCreatingConversation: false,
      });
    }
  }, [clearAllNovaConversationCaches, hydrateNovaConversationMessages, setNovaConversationCache]);

  React.useEffect(() => {
    void hydrateActiveConversation(effectivePersona);
  }, [effectivePersona, hydrateActiveConversation]);

  const setIsThinking = React.useCallback((value: boolean) => {
    setNovaConversationCache(effectivePersona, { isThinking: value });
  }, [effectivePersona, setNovaConversationCache]);

  const setThinkingStatus = React.useCallback((value: NovaThinkingStatus) => {
    setNovaConversationCache(effectivePersona, { thinkingStatus: value });
  }, [effectivePersona, setNovaConversationCache]);

  /**
   * NOVA Proativa (CONTROL OS — Etapa 13): "a Nova pode abrir a conversa
   * sozinha, sem esperar o usuário perguntar" — só quando a conversa ainda
   * está vazia (nunca interrompe uma conversa em andamento) e só quando
   * existe um motivo real: `buildProactiveOpening` devolve `null` quando não
   * há nenhum dado que justifique falar primeiro, e neste caso o efeito não
   * faz nada — nunca preenche o silêncio com uma frase genérica.
   *
   * `hasCheckedOpeningRef` garante que isto rode no máximo uma vez por
   * montagem (o mesmo componente é reaproveitado tanto pela Home quanto pelo
   * `NovaFloatingPanel`, e `messages`/`novaContext` mudam a cada mensagem
   * nova, o que recriaria o efeito repetidamente sem esta trava). A checagem
   * de "conversa vazia" lê `useAppStore.getState()` (estado mais recente),
   * não a variável `messages` fechada no closure — mesmo motivo de
   * O histórico persistido nunca é condensado ou substituído visualmente.
   *
   * Deliberadamente NÃO passa por `conversationService.processTurn` nem por
   * nenhum provedor de IA — é o mesmo `addNovaMessage` direto que qualquer
   * outra resposta da Nova usa (mesmo formato de `ConversationMessage`),
   * só que com texto calculado 100% local e determinístico
   * (`buildProactiveOpening`). Nunca toca `ConversationService`, `EventBus`
   * ou a integração OpenAI — só lê o mesmo `NovaReadOnlyContext` que os
   * outros pontos da tela já leem.
   */
  const checkedOpeningsRef = React.useRef(new Set<string>());
  React.useEffect(() => {
    if (conversationCache.hydrationStatus !== 'ready' || !conversationCache.conversationId) return;
    const openingKey = `${effectivePersona}:${conversationCache.conversationId}`;
    if (checkedOpeningsRef.current.has(openingKey)) return;
    checkedOpeningsRef.current.add(openingKey);

    const currentMessages = useAppStore.getState().novaMessagesByPersona[effectivePersona];
    if (currentMessages.length > 0) return;

    const opening = buildProactiveOpening(toReadOnlyContext(novaContext));
    if (!opening) return;

    addNovaMessage(effectivePersona, {
      id: nextMessageId('nova'),
      role: 'nova',
      content: opening,
      status: 'success',
      persistence: 'transient',
    });
  }, [novaContext, addNovaMessage, effectivePersona, conversationCache.hydrationStatus, conversationCache.conversationId]);

  /**
   * `ConversationTask`s pendentes (Fase D — "NOVA como centro da
   * experiência"): documento analisado (e, no futuro, qualquer outro
   * produtor) que ainda espera uma decisão do usuário. Diferente de
   * `buildProactiveOpening` acima (só fala quando a conversa está vazia),
   * isto roda uma vez por montagem INDEPENDENTE de já haver conversa —
   * "algo aconteceu e a NOVA precisa falar sobre isso" não é uma abertura
   * de papo, é um recado concreto que não deve ficar escondido só porque o
   * usuário já estava conversando de outra coisa. Sem streaming ainda
   * (Fase F): a task só aparece na próxima vez que a NOVA é aberta, igual
   * ao mecanismo anterior de `DocumentInsight` que este substitui.
   */
  const hasCheckedConversationTasksRef = React.useRef(false);
  // `payload` de cada task pendente (Fase E) — só pro resumo final do
  // wizard de campos abaixo (credor/valor/parcelas), nunca pra decidir
  // dinheiro: quem decide é sempre o handler no servidor, buscando o
  // registro de origem de novo.
  const taskPayloadsRef = React.useRef<Record<string, Record<string, unknown>>>({});

  type ConversationTaskSummary = { id: string; message: string; actions: ConversationMessageAction[]; payload?: Record<string, unknown> };

  /**
   * Converte uma `ConversationTask` (vinda de `GET /api/nova/conversation-tasks`)
   * no conteúdo de bolha que a NOVA mostra — usado tanto pela checagem ao
   * montar (abaixo) quanto pela substituição em tempo real da bolha de
   * progresso quando uma análise de documento termina (Fase F). Sempre
   * guarda o `payload` em `taskPayloadsRef` primeiro — o wizard de campos
   * (Fase E) depende dele existir antes do clique em qualquer ação.
   */
  const applyConversationTask = React.useCallback((task: ConversationTaskSummary): Omit<ConversationMessage, 'id' | 'role'> => {
    taskPayloadsRef.current[task.id] = task.payload ?? {};
    return { content: task.message, status: 'success', taskId: task.id, taskActions: task.actions, hideDismiss: false };
  }, []);

  React.useEffect(() => {
    if (hasCheckedConversationTasksRef.current) return;
    hasCheckedConversationTasksRef.current = true;

    void (async () => {
      try {
        const response = await fetch('/api/nova/conversation-tasks');
        if (!response.ok) return;
        const payload = await response.json() as { success?: boolean; tasks?: ConversationTaskSummary[] };
        for (const task of payload.tasks ?? []) {
          addNovaMessage(effectivePersona, { id: nextMessageId('nova'), role: 'nova', ...applyConversationTask(task) });
        }
      } catch {
        // Silêncio é o estado seguro — nunca inventa uma pendência quando a busca falha.
      }
    })();
  }, [effectivePersona, addNovaMessage, applyConversationTask]);

  /**
   * Coleta de campos em chat (Fase E — "concluir 100% no chat", "coletar
   * conta/categoria de forma determinística"). Genérico por natureza: uma
   * `ConversationTaskAction` qualquer pode declarar `requiresFields`
   * (hoje só `accountId`/`categoryId` existem como campo conhecido, ver
   * `services/conversation-tasks/conversation-task.types.ts`) — nenhuma
   * ação específica de Documentos está codificada aqui, só o mecanismo de
   * perguntar um campo por vez com opções REAIS (nunca texto livre
   * interpretado por IA) e juntar tudo antes de resolver.
   *
   * Cada botão de uma pergunta de campo carrega o id real da opção
   * prefixado com `wizard:field:` — e os botões da bolha de confirmação
   * final usam `wizard:confirm`/`wizard:cancel`. Esse prefixo é o que
   * permite detectar um clique num botão "órfão" depois de um refresh
   * (perde-se `fieldWizardsRef`, que é só estado local — nunca o
   * `ConversationTask` em si, que continua `PENDING` no servidor): sem
   * wizard correspondente, o clique nunca chega a montar uma requisição,
   * só pede pra recomeçar.
   */
  type FieldKey = 'accountId' | 'categoryId';
  type FieldWizardState = {
    actionId: string;
    remainingFields: FieldKey[];
    currentField: FieldKey | null;
    selections: Partial<Record<FieldKey, { id: string; label: string }>>;
  };
  const fieldWizardsRef = React.useRef<Record<string, FieldWizardState>>({});

  const fetchFieldOptions = React.useCallback(async (field: FieldKey): Promise<{ id: string; label: string }[]> => {
    if (field === 'accountId') {
      const response = await fetch('/api/finance/accounts');
      if (!response.ok) return [];
      const payload = await response.json() as { success?: boolean; accounts?: Array<{ id: string; name: string; status: string }> };
      return (payload.accounts ?? []).filter((account) => account.status !== 'arquivada').map((account) => ({ id: account.id, label: account.name }));
    }
    const response = await fetch('/api/finance/categories');
    if (!response.ok) return [];
    const payload = await response.json() as { success?: boolean; categories?: Array<{ id: string; name: string; status: string; kind?: string }> };
    return (payload.categories ?? [])
      .filter((category) => category.status !== 'arquivada' && (category.kind === 'despesa' || !category.kind))
      .map((category) => ({ id: category.id, label: category.name }));
  }, []);

  const resolveTaskAction = React.useCallback(async (
    taskId: string,
    actionId: string,
    extra?: { accountId?: string; categoryId?: string; startDate?: string }
  ) => {
    setIsThinking(true);
    setThinkingStatus('executando');
    try {
      const response = await fetch(`/api/nova/conversation-tasks/${taskId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, ...extra }),
      });
      const payload = await response.json().catch(() => null) as { success?: boolean; reply?: string; message?: string } | null;
      addNovaMessage(effectivePersona, {
        id: nextMessageId('nova'),
        role: 'nova',
        content: (response.ok ? payload?.reply : payload?.message) ?? 'Não consegui concluir agora — tenta de novo daqui a pouco.',
        status: response.ok ? 'success' : 'error',
      });
    } catch {
      addNovaMessage(effectivePersona, {
        id: nextMessageId('nova'),
        role: 'nova',
        content: 'Não consegui falar com o servidor agora — tenta de novo daqui a pouco.',
        status: 'error',
      });
    } finally {
      setIsThinking(false);
    }
  }, [addNovaMessage, effectivePersona, setIsThinking, setThinkingStatus]);

  const presentFieldQuestion = React.useCallback(async (taskId: string, field: FieldKey) => {
    const options = await fetchFieldOptions(field);
    if (options.length === 0) {
      delete fieldWizardsRef.current[taskId];
      addNovaMessage(effectivePersona, {
        id: nextMessageId('nova'),
        role: 'nova',
        content: 'Não encontrei opções suficientes pra continuar por aqui agora — tenta de novo em instantes.',
        status: 'error',
      });
      return;
    }
    addNovaMessage(effectivePersona, {
      id: nextMessageId('nova'),
      role: 'nova',
      content: FIELD_QUESTIONS[field],
      status: 'success',
      taskId,
      taskActions: options.map((option) => ({ id: `wizard:field:${option.id}`, label: option.label })),
    });
  }, [addNovaMessage, effectivePersona, fetchFieldOptions]);

  /** Bolha final — "mostrar resumo final antes de executar" — nunca pula direto pra execução. */
  const presentFieldWizardSummary = React.useCallback((taskId: string, wizard: FieldWizardState) => {
    const payload = taskPayloadsRef.current[taskId] ?? {};
    const creditor = typeof payload.creditor === 'string' && payload.creditor ? payload.creditor : 'o credor identificado';
    const amount = typeof payload.amount === 'number' ? formatCurrency(payload.amount) : 'valor não identificado';
    const installments = typeof payload.installments === 'number' ? payload.installments : null;
    const accountLabel = wizard.selections.accountId?.label ?? '—';
    const categoryLabel = wizard.selections.categoryId?.label ?? '—';
    addNovaMessage(effectivePersona, {
      id: nextMessageId('nova'),
      role: 'nova',
      content: `Vou cadastrar: ${creditor}, ${amount}${installments ? ` em ${installments}x` : ''}. Conta: ${accountLabel}. Categoria: ${categoryLabel}. Confirmar?`,
      status: 'success',
      taskId,
      taskActions: [
        { id: 'wizard:confirm', label: 'Confirmar' },
        { id: 'wizard:cancel', label: 'Cancelar' },
      ],
      hideDismiss: true,
    });
  }, [addNovaMessage, effectivePersona]);

  const startFieldWizard = React.useCallback(async (taskId: string, action: ConversationMessageAction) => {
    const fields = action.requiresFields ?? [];
    if (fields.length === 0) return;
    fieldWizardsRef.current[taskId] = { actionId: action.id, remainingFields: fields.slice(1), currentField: fields[0] ?? null, selections: {} };
    if (fields[0]) await presentFieldQuestion(taskId, fields[0]);
  }, [presentFieldQuestion]);

  const advanceFieldWizard = React.useCallback(async (taskId: string, wizard: FieldWizardState, chosenId: string, chosenLabel: string) => {
    if (!wizard.currentField) return;
    const selections = { ...wizard.selections, [wizard.currentField]: { id: chosenId, label: chosenLabel } };
    const nextField = wizard.remainingFields[0] ?? null;
    const updated: FieldWizardState = { ...wizard, currentField: nextField, remainingFields: wizard.remainingFields.slice(1), selections };
    fieldWizardsRef.current[taskId] = updated;
    if (nextField) {
      await presentFieldQuestion(taskId, nextField);
      return;
    }
    presentFieldWizardSummary(taskId, updated);
  }, [presentFieldQuestion, presentFieldWizardSummary]);

  const finishFieldWizard = React.useCallback(async (taskId: string, wizard: FieldWizardState) => {
    const accountId = wizard.selections.accountId?.id;
    const categoryId = wizard.selections.categoryId?.id;
    delete fieldWizardsRef.current[taskId];
    if (!accountId || !categoryId) {
      addNovaMessage(effectivePersona, {
        id: nextMessageId('nova'),
        role: 'nova',
        content: 'Faltou escolher conta ou categoria — clique em "Cadastrar financiamento" de novo.',
        status: 'error',
      });
      return;
    }
    await resolveTaskAction(taskId, wizard.actionId, { accountId, categoryId });
  }, [addNovaMessage, effectivePersona, resolveTaskAction]);

  const cancelFieldWizard = React.useCallback((taskId: string) => {
    delete fieldWizardsRef.current[taskId];
    addNovaMessage(effectivePersona, {
      id: nextMessageId('nova'),
      role: 'nova',
      content: 'Sem problema, não cadastrei nada. Clique em "Cadastrar financiamento" de novo quando quiser tentar outra vez.',
      status: 'success',
    });
  }, [addNovaMessage, effectivePersona]);

  /**
   * Botão de uma `ConversationTask` (Fase D, com coleta de campos desde a
   * Fase E). Continua sem nenhum conhecimento de Documentos ou de
   * qualquer outro produtor: só decide entre três caminhos genéricos —
   * avançar um wizard em andamento, começar um wizard novo (a ação
   * declarou `requiresFields`) ou resolver direto (sem campos extras).
   */
  const handleTaskAction = React.useCallback((taskId: string, action: ConversationMessageAction) => {
    if (action.id.startsWith('wizard:')) {
      const wizard = fieldWizardsRef.current[taskId];
      if (!wizard) {
        addNovaMessage(effectivePersona, {
          id: nextMessageId('nova'),
          role: 'nova',
          content: 'Essa opção expirou — clique em "Cadastrar financiamento" de novo pra recomeçar.',
          status: 'error',
        });
        return;
      }
      if (action.id === 'wizard:confirm') { void finishFieldWizard(taskId, wizard); return; }
      if (action.id === 'wizard:cancel') { cancelFieldWizard(taskId); return; }
      void advanceFieldWizard(taskId, wizard, action.id.slice('wizard:field:'.length), action.label);
      return;
    }

    if (action.requiresFields && action.requiresFields.length > 0) {
      void startFieldWizard(taskId, action);
      return;
    }

    void resolveTaskAction(taskId, action.id);
  }, [addNovaMessage, effectivePersona, finishFieldWizard, cancelFieldWizard, advanceFieldWizard, startFieldWizard, resolveTaskAction]);

  /** Botão "Depois" — sempre genérico, nunca sabe o que a task representa. */
  const handleDismissTask = React.useCallback((taskId: string) => {
    delete fieldWizardsRef.current[taskId];
    void (async () => {
      try {
        const response = await fetch(`/api/nova/conversation-tasks/${taskId}/dismiss`, { method: 'POST' });
        const payload = await response.json().catch(() => null) as { reply?: string } | null;
        if (response.ok) {
          addNovaMessage(effectivePersona, {
            id: nextMessageId('nova'),
            role: 'nova',
            content: payload?.reply ?? 'Tudo bem, deixo pra depois.',
            status: 'success',
          });
        }
      } catch {
        // Silêncio: falha ao descartar não deve quebrar a conversa.
      }
    })();
  }, [addNovaMessage, effectivePersona]);

  /**
   * Sugestões da Home (CONTROL OS — Etapa 9): "nunca sugestões aleatórias,
   * sempre baseadas nos dados" — reaproveita o Recommendation Engine
   * (`generateRecommendations`, Etapa 7) em vez do `QUICK_ACTIONS` estático.
   * Cai de volta pro `QUICK_ACTIONS` só quando não há nenhuma recomendação
   * real ainda (usuário novo, sem dados suficientes).
   *
   * CONTROL OS — Etapa 13 (NOVA Proativa): "até três sugestões naturais" —
   * o Recommendation Engine ganhou 7 categorias novas nesta etapa e, com
   * dado suficiente, pode gerar bem mais de 3 recomendações reais ao mesmo
   * tempo; sem o corte, o campo de conversa viraria uma parede de pills
   * (exatamente o "jamais exagerar" que a etapa pede pra evitar).
   */
  const suggestions = React.useMemo(() => {
    const recommendations = generateRecommendations(toReadOnlyContext(novaContext)).slice(0, 3);
    return recommendations.map((recommendation) => ({
      icon: SUGGESTION_ICON_BY_CATEGORY[recommendation.category],
      label: SUGGESTION_LABEL_BY_CATEGORY[recommendation.category],
    }));
  }, [novaContext]);

  const quickActions = suggestions.length > 0 ? suggestions : QUICK_ACTIONS;

  const persistCompletedTurn = React.useCallback(async (pending: PendingConversationTurn): Promise<void> => {
    const current = useAppStore.getState().novaConversationByPersona[pending.persona];
    if (!isOperationCurrent(current, pending)) return;

    setNovaConversationCache(pending.persona, {
      pendingTurns: { ...current.pendingTurns, [pending.clientTurnId]: pending },
    });

    try {
      const turn = await novaConversationApiClient.persistTurn(pending.conversationId, pending.payload);
      const latest = useAppStore.getState().novaConversationByPersona[pending.persona];
      if (!isOperationCurrent(latest, pending)) return;
      reconcileNovaConversationTurn(pending.persona, pending.clientTurnId, turn);
      const remaining = { ...latest.pendingTurns };
      delete remaining[pending.clientTurnId];
      setNovaConversationCache(pending.persona, { pendingTurns: remaining, error: null });
    } catch (cause) {
      if (cause instanceof NovaConversationApiError && cause.status === 401) {
        clearAllNovaConversationCaches();
        return;
      }
      const latest = useAppStore.getState().novaConversationByPersona[pending.persona];
      if (!isOperationCurrent(latest, pending)) return;
      markNovaConversationTurnUnsynced(pending.persona, pending.clientTurnId);
      setNovaConversationCache(pending.persona, {
        error: cause instanceof NovaConversationApiError ? cause.message : 'Não foi possível salvar este turno.',
      });
    }
  }, [clearAllNovaConversationCaches, markNovaConversationTurnUnsynced, reconcileNovaConversationTurn, setNovaConversationCache]);

  const processControlledTurn = React.useCallback(async (
    pending: PendingOrchestratorTurn
  ): Promise<'HANDLED' | 'LEGACY'> => {
    const current = useAppStore.getState().novaConversationByPersona[pending.persona];
    if (!isOperationCurrent(current, pending)) return 'HANDLED';
    setNovaConversationCache(pending.persona, {
      isThinking: true,
      pendingOrchestratorTurns: {
        ...current.pendingOrchestratorTurns,
        [pending.clientTurnId]: pending,
      },
      error: null,
    });

    const removePending = () => {
      const latest = useAppStore.getState().novaConversationByPersona[pending.persona];
      const remaining = { ...latest.pendingOrchestratorTurns };
      delete remaining[pending.clientTurnId];
      setNovaConversationCache(pending.persona, { pendingOrchestratorTurns: remaining });
    };

    const showRetryableFailure = (content: string) => {
      const messages = useAppStore.getState().novaMessagesByPersona[pending.persona];
      const assistant = messages.find((message) => message.clientTurnId === pending.clientTurnId && message.role === 'nova');
      if (assistant) {
        updateNovaMessage(pending.persona, assistant.id, { content, status: 'error', persistence: 'unsynced' });
      } else {
        addNovaMessage(pending.persona, {
          id: nextMessageId('nova'),
          role: 'nova',
          content,
          status: 'error',
          persistence: 'unsynced',
          clientTurnId: pending.clientTurnId,
        });
      }
      markNovaConversationTurnUnsynced(pending.persona, pending.clientTurnId);
      setNovaConversationCache(pending.persona, { isThinking: false, lastMessageMutation: 'append' });
    };

    try {
      const route = await routeControlledOrchestratorTurn(
        (payload) => novaConversationApiClient.processMessage(pending.conversationId, payload),
        pending.payload
      );
      if (route.kind === 'LEGACY') {
        removePending();
        return 'LEGACY';
      }

      if (route.result.status === 'COMPLETED') {
        reconcileNovaConversationTurn(
          pending.persona,
          pending.clientTurnId,
          orchestratorMessagesToTurn(route.result.messages)
        );
        removePending();
        setNovaConversationCache(pending.persona, { isThinking: false, error: null, lastMessageMutation: 'reconcile' });
        return 'HANDLED';
      }

      if (route.result.status === 'PROCESSING') {
        showRetryableFailure('Este turno ainda está sendo processado. Tente sincronizar novamente em instantes.');
        return 'HANDLED';
      }

      const messages = useAppStore.getState().novaMessagesByPersona[pending.persona];
      for (const message of messages.filter((item) => item.clientTurnId === pending.clientTurnId)) {
        updateNovaMessage(pending.persona, message.id, { persistence: 'transient', clientTurnId: undefined });
      }
      addNovaMessage(pending.persona, {
        id: nextMessageId('nova'),
        role: 'nova',
        content: route.result.error.message,
        status: 'error',
        persistence: 'transient',
      });
      removePending();
      setNovaConversationCache(pending.persona, { isThinking: false, lastMessageMutation: 'append' });
      return 'HANDLED';
    } catch (cause) {
      if (cause instanceof NovaConversationApiError && cause.status === 401) {
        clearAllNovaConversationCaches();
        return 'HANDLED';
      }
      showRetryableFailure('Não foi possível confirmar o processamento server-side. Tente sincronizar novamente.');
      setNovaConversationCache(pending.persona, {
        error: cause instanceof NovaConversationApiError ? cause.message : 'Não foi possível conectar ao Orchestrator.',
      });
      return 'HANDLED';
    }
  }, [
    addNovaMessage,
    clearAllNovaConversationCaches,
    markNovaConversationTurnUnsynced,
    reconcileNovaConversationTurn,
    setNovaConversationCache,
    updateNovaMessage,
  ]);

  const handleRetrySync = React.useCallback((clientTurnId: string) => {
    const cache = useAppStore.getState().novaConversationByPersona[effectivePersona];
    const orchestratorPending = cache.pendingOrchestratorTurns[clientTurnId];
    if (orchestratorPending) {
      void processControlledTurn(orchestratorPending);
      return;
    }
    const pending = cache.pendingTurns[clientTurnId];
    if (pending) void persistCompletedTurn(pending);
  }, [effectivePersona, persistCompletedTurn, processControlledTurn]);

  const handleLoadPrevious = React.useCallback(() => {
    const persona = effectivePersona;
    const cache = useAppStore.getState().novaConversationByPersona[persona];
    if (!cache.conversationId || !cache.hasMore || !cache.nextCursor || cache.isLoadingPrevious) return;

    const conversationId = cache.conversationId;
    const requestGeneration = cache.requestGeneration;
    setNovaConversationCache(persona, { isLoadingPrevious: true, error: null });
    void (async () => {
      try {
        const page = await novaConversationApiClient.listMessages(conversationId, cache.nextCursor ?? undefined, 100);
        const latest = useAppStore.getState().novaConversationByPersona[persona];
        if (!isOperationCurrent(latest, { conversationId, requestGeneration })) return;
        prependNovaConversationMessages(persona, page.items);
        setNovaConversationCache(persona, {
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
          isLoadingPrevious: false,
        });
      } catch (cause) {
        if (cause instanceof NovaConversationApiError && cause.status === 401) {
          clearAllNovaConversationCaches();
          return;
        }
        const latest = useAppStore.getState().novaConversationByPersona[persona];
        if (!isOperationCurrent(latest, { conversationId, requestGeneration })) return;
        setNovaConversationCache(persona, {
          isLoadingPrevious: false,
          error: cause instanceof NovaConversationApiError ? cause.message : 'Não foi possível carregar mensagens anteriores.',
        });
      }
    })();
  }, [clearAllNovaConversationCaches, effectivePersona, prependNovaConversationMessages, setNovaConversationCache]);

  const handleNewConversation = React.useCallback(() => {
    const persona = effectivePersona;
    const cache = useAppStore.getState().novaConversationByPersona[persona];
    if (!cache.conversationId || cache.isThinking || cache.isCreatingConversation) return;
    const previousConversationId = cache.conversationId;
    setNovaConversationCache(persona, { isCreatingConversation: true, error: null });
    void (async () => {
      try {
        await novaConversationApiClient.closeConversation(previousConversationId);
        conversationService.cancelPending(previousConversationId);
        resetNovaConversationCache(persona);
        setNovaConversationCache(persona, { isCreatingConversation: true });
        await hydrateActiveConversation(persona, true);
      } catch (cause) {
        setNovaConversationCache(persona, {
          isCreatingConversation: false,
          error: cause instanceof NovaConversationApiError ? cause.message : 'Não foi possível iniciar uma nova conversa.',
        });
      }
    })();
  }, [effectivePersona, hydrateActiveConversation, resetNovaConversationCache, setNovaConversationCache]);

  const handleSend = React.useCallback(
    (text: string, source: NovaInputSource = 'text') => {
      const capturedPersona = effectivePersona;
      const capturedCache = useAppStore.getState().novaConversationByPersona[capturedPersona];
      if (capturedCache.hydrationStatus !== 'ready' || !capturedCache.conversationId || capturedCache.isThinking) return;

      const capturedConversationId = capturedCache.conversationId;
      const capturedGeneration = capturedCache.requestGeneration;
      const clientTurnId = nextClientTurnId();
      setShowCommandOverview(false);
      const userMessage: ConversationMessage = {
        id: nextMessageId('user'),
        role: 'user',
        content: text,
        persistence: 'optimistic',
        clientTurnId,
      };
      addNovaMessage(capturedPersona, userMessage);
      setNovaConversationCache(capturedPersona, { isThinking: true, thinkingStatus: 'pensando', lastMessageMutation: 'append' });

      void (async () => {
        // A chamada real começa já — o timer só troca a legenda da bolha
        // pra "Executando" se a resposta demorar, e é cancelado assim que
        // ela chega (nunca atrasa nada, só preenche a espera quando existe).
        const executingTimer = window.setTimeout(() => {
          const latest = useAppStore.getState().novaConversationByPersona[capturedPersona];
          if (latest.conversationId === capturedConversationId && latest.requestGeneration === capturedGeneration) {
            setNovaConversationCache(capturedPersona, { thinkingStatus: 'executando' });
          }
        }, EXECUTING_SWITCH_MS);

        const controlledRoute = await processControlledTurn({
          clientTurnId,
          conversationId: capturedConversationId,
          persona: capturedPersona,
          requestGeneration: capturedGeneration,
          payload: buildProcessMessageRequest(clientTurnId, text),
        });
        if (controlledRoute === 'HANDLED') {
          window.clearTimeout(executingTimer);
          return;
        }

        // Pedido explícito de arquivo: a NOVA não inventa um link nem expõe
        // arquivos de outra pessoa. Procura somente na biblioteca privada da
        // sessão e devolve um download temporariamente autenticado.
        const normalizedText = text.toLocaleLowerCase('pt-BR');
        const isDocumentRequest = /\b(envie|mande|mandar|baixar|baixe|reenviar|reenvie)\b/.test(normalizedText)
          && /\b(arquivo|documento|pdf|contrato|comprovante)\b/.test(normalizedText);
        if (isDocumentRequest) {
          try {
            const response = await fetch('/api/documents');
            const payload = await response.json() as { success?: boolean; documents?: Array<{ id: string; title: string; originalFileName: string }> };
            const significantWords = normalizedText
              .replace(/[^a-zà-ú0-9\s]/gi, ' ')
              .split(/\s+/)
              .filter((word) => word.length > 3 && !['envie', 'mande', 'arquivo', 'documento', 'contrato', 'comprovante', 'baixar', 'reenvie'].includes(word));
            const document = payload.documents?.find((candidate) => {
              const haystack = `${candidate.title} ${candidate.originalFileName}`.toLocaleLowerCase('pt-BR');
              return significantWords.length === 0 || significantWords.some((word) => haystack.includes(word));
            });
            if (response.ok && document) {
              window.clearTimeout(executingTimer);
              const assistantContent = `Encontrei “${document.title}”.`;
              addNovaMessage(capturedPersona, {
                id: nextMessageId('nova'),
                role: 'nova',
                content: assistantContent,
                attachment: { label: document.originalFileName, href: `/api/documents/${document.id}/download` },
                status: 'success',
                persistence: 'optimistic',
                clientTurnId,
              });
              setNovaConversationCache(capturedPersona, { isThinking: false, lastMessageMutation: 'append' });
              void persistCompletedTurn({
                clientTurnId,
                conversationId: capturedConversationId,
                persona: capturedPersona,
                requestGeneration: capturedGeneration,
                payload: buildPersistTurnRequest(clientTurnId, text, assistantContent),
              });
              return;
            }
          } catch {
            // Se a biblioteca falhar, continua para a conversa normal sem
            // prometer que encontrou um arquivo.
          }
        }

        try {
          const result = await conversationService.processTurn(text, novaContext, capturedConversationId, capturedPersona);
          window.clearTimeout(executingTimer);
          const shouldPersist = result.status === 'concluido';
          if (!shouldPersist) updateNovaMessage(capturedPersona, userMessage.id, { persistence: 'transient' });
          addNovaMessage(capturedPersona, {
            id: nextMessageId('nova'),
            role: 'nova',
            content: result.reply,
            checklist: result.checklist,
            status: resultStatusToMessageStatus(result.status),
            persistence: shouldPersist ? 'optimistic' : 'transient',
            ...(shouldPersist ? { clientTurnId } : {}),
          });
          setNovaConversationCache(capturedPersona, { isThinking: false, lastMessageMutation: 'append' });

          if (shouldPersist) {
            void persistCompletedTurn({
              clientTurnId,
              conversationId: capturedConversationId,
              persona: capturedPersona,
              requestGeneration: capturedGeneration,
              payload: buildPersistTurnRequest(clientTurnId, text, result.reply),
            });
          }

          if (source === 'voice' && getVoiceProvider().isSupported) {
            setIsSpeakingReply(true);
            getVoiceProvider().speak(result.reply, {
              persona: capturedPersona,
              onBoundary: () => setSpeechPulse((tick) => tick + 1),
              onEnd: () => setIsSpeakingReply(false),
              onError: () => setIsSpeakingReply(false),
            });
          }
        } catch {
          window.clearTimeout(executingTimer);
          updateNovaMessage(capturedPersona, userMessage.id, { persistence: 'transient' });
          addNovaMessage(capturedPersona, {
            id: nextMessageId('nova'),
            role: 'nova',
            content: 'Não consegui concluir esta resposta agora.',
            status: 'error',
            persistence: 'transient',
          });
          setNovaConversationCache(capturedPersona, { isThinking: false, lastMessageMutation: 'append' });
        }
      })();
    },
    [novaContext, addNovaMessage, effectivePersona, persistCompletedTurn, processControlledTurn, setNovaConversationCache, updateNovaMessage]
  );

  /** Guarda o arquivo na área privada. Um contrato gera somente uma prévia:
   * a confirmação e o cadastro financeiro acontecem depois em Documentos. */
  const handleAttachDocument = React.useCallback(
    (file: File) => {
      setShowCommandOverview(false);
      addNovaMessage(effectivePersona, {
        id: nextMessageId('user'),
        role: 'user',
        content: `Arquivo enviado: ${file.name}`,
      });
      setIsThinking(true);
      setThinkingStatus('executando');

      // Fase F ("NOVA como centro da experiência"): UMA bolha acompanha o
      // arquivo do início ao fim — "Verificando segurança…" (o scan roda
      // durante o próprio upload, sem job ainda pra sondar), depois os
      // estágios reais do worker via polling curto, até ser substituída
      // pelo resultado final (a ConversationTask de verdade, Fase C/D/E,
      // ou uma mensagem de erro). Nunca manda o usuário "atualizar a
      // página" ou reabrir a NOVA pra saber o que aconteceu.
      const progressMessageId = nextMessageId('nova');
      addNovaMessage(effectivePersona, { id: progressMessageId, role: 'nova', content: progressStageLabel('VERIFYING_SECURITY') });

      void (async () => {
        try {
          const formData = new FormData();
          formData.set('file', file);
          const uploadResponse = await fetch('/api/documents', { method: 'POST', body: formData });
          const uploadPayload = await uploadResponse.json() as { success?: boolean; message?: string; document?: { id: string; title: string; mimeType: string } };
          if (!uploadResponse.ok || !uploadPayload.success || !uploadPayload.document) throw new Error(uploadPayload.message ?? 'Não foi possível guardar o arquivo.');

          const document = uploadPayload.document;
          if (document.mimeType !== 'application/pdf') {
            updateNovaMessage(effectivePersona, progressMessageId, {
              content: `Guardei “${document.title}” na sua área privada de Documentos. Quando quiser, peça este arquivo pelo chat que eu preparo o download.`,
              status: 'success',
            });
            setIsThinking(false);
            return;
          }

          const proposalResponse = await fetch(`/api/documents/${document.id}/contract-proposal`, { method: 'POST' });
          const proposalPayload = await proposalResponse.json() as { success?: boolean; message?: string };
          if (!proposalResponse.ok || !proposalPayload.success) throw new Error(proposalPayload.message ?? 'O PDF foi guardado, mas não consegui ler o contrato agora.');

          updateNovaMessage(effectivePersona, progressMessageId, { content: `Guardei “${document.title}”. ${progressStageLabel('READING_DOCUMENT')}` });
          setIsThinking(false);

          pollDocumentAnalysisProgress(document.id, {
            onUpdate: (result) => {
              updateNovaMessage(effectivePersona, progressMessageId, { content: `Guardei “${document.title}”. ${result.label}` });
            },
            onSettled: (result) => {
              if (result.failed) {
                updateNovaMessage(effectivePersona, progressMessageId, {
                  content: `Não consegui concluir a análise de “${document.title}” agora. Revise em Documentos quando quiser tentar de novo.`,
                  status: 'error',
                });
                return;
              }
              void (async () => {
                try {
                  const tasksResponse = await fetch('/api/nova/conversation-tasks');
                  const tasksPayload = await tasksResponse.json() as { success?: boolean; tasks?: ConversationTaskSummary[] };
                  // Documento acabou de terminar — a ConversationTask criada
                  // na mesma transação do worker (Fase C) é a mais nova pra
                  // este documentId; nunca inventa conteúdo se ela não
                  // aparecer ainda (poll seguinte do endpoint de progresso já
                  // teria pego COMPLETED só depois de a transação commitar).
                  const task = (tasksPayload.tasks ?? []).find((candidate) => candidate.payload?.documentId === document.id);
                  updateNovaMessage(effectivePersona, progressMessageId, task
                    ? applyConversationTask(task)
                    : { content: `Terminei de analisar “${document.title}”. Dá uma olhada em Documentos quando quiser.`, status: 'success' });
                } catch {
                  updateNovaMessage(effectivePersona, progressMessageId, {
                    content: `Terminei de analisar “${document.title}”. Dá uma olhada em Documentos quando quiser.`,
                    status: 'success',
                  });
                }
              })();
            },
          });
        } catch (error) {
          updateNovaMessage(effectivePersona, progressMessageId, {
            content: error instanceof Error ? error.message : 'Não consegui guardar o arquivo agora.',
            status: 'error',
          });
          setIsThinking(false);
        }
      })();
    },
    [addNovaMessage, updateNovaMessage, applyConversationTask, effectivePersona, setIsThinking, setThinkingStatus]
  );

  const handleConfirmPending = React.useCallback(() => {
    if (!conversationId) return;
    setIsThinking(true);
    setThinkingStatus('executando');

    void (async () => {
      // A persona ATUAL confirma — se o usuário trocou de identidade entre
      // a pergunta e a confirmação, é a identidade de agora que narra o
      // resultado (ver comentário em `ConversationService.executePending`).
      const result = await conversationService.confirmPending(novaContext, conversationId, effectivePersona);
      addNovaMessage(effectivePersona, {
        id: nextMessageId('nova'),
        role: 'nova',
        content: result.reply,
        checklist: result.checklist,
        status: resultStatusToMessageStatus(result.status),
        persistence: 'transient',
      });
      setIsThinking(false);
    })();
  }, [novaContext, addNovaMessage, conversationId, effectivePersona, setIsThinking, setThinkingStatus]);

  const handleCancelPending = React.useCallback(() => {
    if (!conversationId) return;
    const result = conversationService.cancelPending(conversationId);
    addNovaMessage(effectivePersona, {
      id: nextMessageId('nova'),
      role: 'nova',
      content: result.reply,
      status: resultStatusToMessageStatus(result.status),
      persistence: 'transient',
    });
  }, [addNovaMessage, conversationId, effectivePersona]);

  // CONTROL OS — Etapa 11C: `isListening`/`isSpeakingReply` (microfone
  // inline) têm prioridade sobre `isThinking` na leitura do estado — os
  // dois nunca ficam `true` ao mesmo tempo na prática (o microfone fica
  // desabilitado enquanto `isThinking`), mas a ordem deixa a intenção clara.
  const orbStatus: NovaOrbStatus = isListening
    ? 'ouvindo'
    : isThinking
      ? thinkingStatus
      : isSpeakingReply
        ? 'respondendo'
        : 'idle';
  // A esfera "cresce" enquanto a NOVA pensa/executa/ouve/fala — a reação
  // visual que acompanha cada estado.
  const orbScale =
    orbStatus === 'executando'
      ? 1.18
      : orbStatus === 'pensando'
        ? 1.08
        : orbStatus === 'respondendo'
          ? 1.12
          : orbStatus === 'ouvindo'
            ? 1.06
            : 1;

  const inputRow = (
    <div className="mx-auto w-full max-w-2xl">
      <NovaInput
        onSubmit={handleSend}
        onAttach={handleAttachDocument}
        disabled={isThinking || conversationCache.hydrationStatus !== 'ready' || conversationCache.isCreatingConversation}
        onListeningChange={setIsListening}
        persona={effectivePersona}
      />
      {showQuickActions && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {quickActions.map((action) => (
            <QuickAction
              key={action.label}
              icon={action.icon}
              label={action.label}
              onClick={() => handleSend(action.label)}
            />
          ))}
        </div>
      )}
    </div>
  );

  const conversationArea = (
    <>
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            {conversationCache.hydrationStatus === 'loading' && (
              <span className="text-xs text-text-secondary">Carregando conversa…</span>
            )}
            {conversationCache.hydrationStatus === 'error' && (
              <button
                type="button"
                className="text-xs text-red-300 underline underline-offset-4"
                onClick={() => void hydrateActiveConversation(effectivePersona, true)}
              >
                Tentar carregar novamente
              </button>
            )}
            {conversationCache.hasMore && conversationCache.hydrationStatus === 'ready' && (
              <button
                type="button"
                className="text-xs text-text-secondary underline-offset-4 hover:text-text-primary hover:underline disabled:opacity-50"
                onClick={handleLoadPrevious}
                disabled={conversationCache.isLoadingPrevious}
              >
                {conversationCache.isLoadingPrevious ? 'Carregando…' : 'Carregar mensagens anteriores'}
              </button>
            )}
          </div>
          {conversationCache.hydrationStatus === 'ready' && conversationCache.conversationId && (
            <button
              type="button"
              className="text-xs text-text-secondary underline-offset-4 hover:text-text-primary hover:underline disabled:opacity-50"
              onClick={handleNewConversation}
              disabled={isThinking || conversationCache.isCreatingConversation}
            >
              {conversationCache.isCreatingConversation ? 'Criando…' : 'Nova conversa'}
            </button>
          )}
        </div>
        <NovaConversation
          messages={messages}
          isThinking={isThinking}
          thinkingStatus={thinkingStatus}
          onConfirmPending={handleConfirmPending}
          onCancelPending={handleCancelPending}
          onTaskAction={handleTaskAction}
          onDismissTask={handleDismissTask}
          onRetrySync={handleRetrySync}
          persona={effectivePersona}
        />
      </div>

      {showIntelligentPanel && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitionOut(0.4)}
        >
          <IntelligentPanel />
        </motion.div>
      )}
    </>
  );

  if (variant === 'docked') {
    const isCommandOverviewVisible = showCommandOverview && Boolean(lockedPersona);
    const commandOverview = effectivePersona === 'nova'
      ? <NovaCommandOverview onAction={handleSend} />
      : <LegendaryCommandOverview onAction={handleSend} />;

    return (
      <div className="flex h-[calc(100dvh-11rem)] min-h-0 flex-col overflow-hidden md:h-[calc(100dvh-4rem)]">
        <div ref={dockedScrollRef} className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
          <div className={`mx-auto flex w-full flex-col items-center gap-6 ${isCommandOverviewVisible ? 'max-w-6xl' : 'max-w-3xl'}`}>
            {/* CONTROL OS — /nova e /legendary agora são ambientes fixos
                (`lockedPersona`) — trocar de identidade é navegar pro
                outro, pelo botão flutuante global (`NovaFloatingLauncher`),
                nunca mais um seletor que muda estado nesta mesma tela. */}
            {!lockedPersona && <NovaPersonaSwitch persona={activePersona} onChange={setActivePersona} />}

            {isCommandOverviewVisible ? commandOverview : messages.length === 0 && topContent}

            {isCommandOverviewVisible && messages.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCommandOverview(false)}
                className="text-sm text-text-secondary underline-offset-4 transition-colors hover:text-text-primary hover:underline"
              >
                Abrir conversa anterior
              </button>
            )}

            {/* Tamanho do container é fixo por breakpoint — só o `scale`
                muda — pra não forçar o canvas a recalcular resolução a cada
                resposta. CONTROL OS — Etapa 12: "mobile-first — a esfera
                ocupa praticamente metade da primeira tela ao abrir." `44vh`
                (limitado a 20rem pra não estourar em telas bem altas)
                garante isso sem media query nova — a partir de `sm:` volta
                ao tamanho fixo de desktop. */}
            {!isCommandOverviewVisible && messages.length === 0 && (
              <motion.div
                animate={{ scale: orbScale }}
                transition={transitionSpring}
                className="flex h-[44vh] w-[44vh] max-h-[20rem] max-w-[20rem] shrink-0 items-center justify-center sm:h-80 sm:w-80"
              >
              {/* CONTROL OS — Etapa 9: "NOVA ORB. Grande. Viva. Respirando."
                  CONTROL OS — HERO SCENE REBOOT: esta é a única Orb grande
                  e central do produto — `NovaHeroStage` decide, por
                  persona, se renderiza o anel flat da NOVA (CSS) ou o
                  cristal em React Three Fiber da LEGENDARY (ver
                  `nova-hero-stage.tsx`). `NovaFloatingLauncher` e o
                  `NovaFloatingPanel` inline continuam usando a `NovaOrb`
                  original, intocados. */}
                <NovaHeroStage status={orbStatus} pulseSignal={speechPulse} persona={effectivePersona} />
              </motion.div>
            )}

            {!isCommandOverviewVisible && messages.length === 0 && belowOrbContent}

            {!isCommandOverviewVisible && <div className="flex w-full flex-col gap-6">{conversationArea}</div>}
          </div>
        </div>
        <div className="shrink-0 border-t border-tint/[0.08] bg-bg/95 px-4 py-3 backdrop-blur-xl sm:px-8 sm:py-4">
          {inputRow}
        </div>
      </div>
    );
  }

  if (containedConversation) {
    return (
      <div className="flex h-[min(58dvh,34rem)] min-h-[22rem] w-full flex-col overflow-hidden rounded-2xl border border-tint/[0.07] bg-tint/[0.015]">
        <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 py-5 sm:px-6">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
            {conversationArea}
          </div>
        </div>
        {/* O rodapé do compositor era `bg-[#060708]/95` — um preto absoluto
            escrito na mão, que nenhum tema conseguia acompanhar. Contra o
            conteúdo claro ele virava uma faixa preta atravessando o painel.
            Agora usa a mesma superfície do rodapé do `variant="docked"`
            (`bg-bg/95`): no escuro o valor é praticamente o de antes
            (#050505 contra #060708), no claro acompanha a página. */}
        <div className="shrink-0 border-t border-tint/[0.07] bg-bg/95 px-4 py-3 backdrop-blur-xl sm:px-6">
          {inputRow}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Mesmo seletor do `variant="docked"` (ver comentário lá) — o painel
          flutuante (`NovaFloatingPanel`) usa este `variant="inline"`.
          CONTROL OS — "o modal deve detectar automaticamente a rota atual
          (/nova ou /legendary) e iniciar já na IA correspondente": quando
          `NovaFloatingPanel` passa `lockedPersona` (porque foi aberto de
          dentro de /nova ou /legendary), o seletor também some aqui — mesma
          regra do `variant="docked"` (ver `!lockedPersona` acima). Sem
          isto, o usuário conseguiria trocar de persona por dentro do modal
          sem navegar, quebrando a mesma separação completa da Etapa desta
          sessão. */}
      {!lockedPersona && (
        <div className="flex justify-center">
          <NovaPersonaSwitch persona={activePersona} onChange={setActivePersona} />
        </div>
      )}
      {conversationFirst ? (
        <>
          {conversationArea}
          {inputRow}
        </>
      ) : (
        <>
          {inputRow}
          {conversationArea}
        </>
      )}
    </div>
  );
}
