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
import type { ConversationMessage, ConversationMessageStatus } from '@/components/nova/nova-message-bubble';
import type { NovaThinkingStatus } from '@/components/nova/nova-thinking';
import type { NovaOrbStatus } from '@/components/nova/nova-orb';
import { QuickAction } from '@/components/ui/quick-action';
import { IntelligentPanel } from '@/components/home/intelligent-panel';
import { NovaHeroStage } from '@/components/nova/nova-hero-stage';
import { NovaCommandOverview } from '@/components/nova/nova-command-overview';
import { LegendaryCommandOverview } from '@/components/nova/legendary-command-overview';
import { conversationService, KEEP_RECENT_TURNS, shouldCondense } from '@/services/ai';
import { buildProactiveOpening, generateRecommendations, toReadOnlyContext } from '@/services/nova';
import type { NovaPersona, NovaRecommendationCategory, NovaStatus } from '@/services/nova';
import { getVoiceProvider } from '@/services/voice';
import { useAppStore } from '@/lib/store';
import { useNovaContext } from '@/lib/use-nova-context';
import { transitionOut, transitionSpring } from '@/lib/motion';

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

let messageIdCounter = 0;

/** Gera um id sequencial estável para mensagens da conversa (sem `crypto`). */
function nextMessageId(prefix: string): string {
  messageIdCounter += 1;
  return `${prefix}_${messageIdCounter}`;
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
}: NovaWorkspaceProps) {
  // Vive no `useAppStore` (não mais `useState` local) — sobrevive a
  // fechar/reabrir o painel flutuante. Ver comentário em `lib/store.ts`.
  const addNovaMessage = useAppStore((state) => state.addNovaMessage);
  const replaceNovaMessages = useAppStore((state) => state.replaceNovaMessages);
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

  // CONTROL OS — "separação completa entre NOVA e LEGENDARY": antes, todo
  // turno de texto usava a sessão padrão fixa de `ConversationService`
  // (`sessionId` nunca passado por aqui) — uma ação sensível pendente de
  // confirmação na NOVA ficava visível/confirmável até de dentro da
  // LEGENDARY (mesmo `pendingBySession`). Uma sessão por persona isola isso
  // também no nível de confirmação, não só de histórico visual.
  const textSessionId = `text_${effectivePersona}`;

  const [isThinking, setIsThinking] = React.useState(false);
  const [thinkingStatus, setThinkingStatus] = React.useState<NovaThinkingStatus>('pensando');
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
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, isThinking]);

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
   * `maybeCondenseConversation` abaixo.
   *
   * Deliberadamente NÃO passa por `conversationService.processTurn` nem por
   * nenhum provedor de IA — é o mesmo `addNovaMessage` direto que qualquer
   * outra resposta da Nova usa (mesmo formato de `ConversationMessage`),
   * só que com texto calculado 100% local e determinístico
   * (`buildProactiveOpening`). Nunca toca `ConversationService`, `EventBus`
   * ou a integração OpenAI — só lê o mesmo `NovaReadOnlyContext` que os
   * outros pontos da tela já leem.
   */
  const hasCheckedOpeningRef = React.useRef(false);
  React.useEffect(() => {
    if (hasCheckedOpeningRef.current) return;
    if (useAppStore.getState().novaMessagesByPersona[effectivePersona].length > 0) return;
    hasCheckedOpeningRef.current = true;

    const opening = buildProactiveOpening(toReadOnlyContext(novaContext));
    if (!opening) return;

    addNovaMessage(effectivePersona, {
      id: nextMessageId('nova'),
      role: 'nova',
      content: opening,
      status: 'success',
    });
  }, [novaContext, addNovaMessage, effectivePersona]);

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

  /**
   * Resumo automático de conversa (CONTROL OS — Etapa 4): quando o
   * histórico passa de `CONDENSE_THRESHOLD` mensagens, condensa tudo menos
   * as últimas `KEEP_RECENT_TURNS` num único resumo — "a arquitetura deve
   * suportar milhares de mensagens sem crescer indefinidamente". Lê o
   * estado mais recente via `useAppStore.getState()` (não a variável
   * `messages` fechada no closure) porque isto roda depois de um `await`,
   * quando o array já pode ter mudado.
   */
  const maybeCondenseConversation = React.useCallback(() => {
    const latest = useAppStore.getState().novaMessagesByPersona[effectivePersona];
    if (!shouldCondense(latest.length)) return;

    const older = latest.slice(0, latest.length - KEEP_RECENT_TURNS);
    const recent = latest.slice(latest.length - KEEP_RECENT_TURNS);

    void conversationService.summarizeOlderTurns(older).then((summaryText) => {
      replaceNovaMessages(effectivePersona, [
        {
          id: nextMessageId('summary'),
          role: 'nova',
          content: `Resumo da conversa anterior: ${summaryText}`,
          status: 'success',
        },
        ...recent,
      ]);
    });
  }, [replaceNovaMessages, effectivePersona]);

  const handleSend = React.useCallback(
    (text: string, source: NovaInputSource = 'text') => {
      const userMessage: ConversationMessage = {
        id: nextMessageId('user'),
        role: 'user',
        content: text,
      };
      addNovaMessage(effectivePersona, userMessage);
      setIsThinking(true);
      setThinkingStatus('pensando');

      void (async () => {
        // A chamada real começa já — o timer só troca a legenda da bolha
        // pra "Executando" se a resposta demorar, e é cancelado assim que
        // ela chega (nunca atrasa nada, só preenche a espera quando existe).
        const executingTimer = window.setTimeout(() => setThinkingStatus('executando'), EXECUTING_SWITCH_MS);

        const result = await conversationService.processTurn(text, novaContext, textSessionId, effectivePersona);
        window.clearTimeout(executingTimer);
        addNovaMessage(effectivePersona, {
          id: nextMessageId('nova'),
          role: 'nova',
          content: result.reply,
          checklist: result.checklist,
          status: resultStatusToMessageStatus(result.status),
        });
        setIsThinking(false);
        maybeCondenseConversation();

        // CONTROL OS — Etapa 11C: "clique → ouvindo → captura → envia
        // automaticamente → pensando → falando → idle, sem etapas extras."
        // Um turno iniciado pelo microfone inline também recebe a resposta
        // falada em voz alta — turnos por texto continuam silenciosos, como
        // sempre. Mesmo `VoiceProvider` já usado por `NovaVoiceOverlay`, só
        // um segundo consumidor.
        if (source === 'voice' && getVoiceProvider().isSupported) {
          setIsSpeakingReply(true);
          getVoiceProvider().speak(result.reply, {
            onBoundary: () => setSpeechPulse((tick) => tick + 1),
            onEnd: () => setIsSpeakingReply(false),
            onError: () => setIsSpeakingReply(false),
          });
        }
      })();
    },
    [novaContext, addNovaMessage, maybeCondenseConversation, effectivePersona, textSessionId]
  );

  const handleConfirmPending = React.useCallback(() => {
    setIsThinking(true);
    setThinkingStatus('executando');

    void (async () => {
      // A persona ATUAL confirma — se o usuário trocou de identidade entre
      // a pergunta e a confirmação, é a identidade de agora que narra o
      // resultado (ver comentário em `ConversationService.executePending`).
      const result = await conversationService.confirmPending(novaContext, textSessionId, effectivePersona);
      addNovaMessage(effectivePersona, {
        id: nextMessageId('nova'),
        role: 'nova',
        content: result.reply,
        checklist: result.checklist,
        status: resultStatusToMessageStatus(result.status),
      });
      setIsThinking(false);
      maybeCondenseConversation();
    })();
  }, [novaContext, addNovaMessage, maybeCondenseConversation, effectivePersona, textSessionId]);

  const handleCancelPending = React.useCallback(() => {
    const result = conversationService.cancelPending(textSessionId);
    addNovaMessage(effectivePersona, {
      id: nextMessageId('nova'),
      role: 'nova',
      content: result.reply,
      status: resultStatusToMessageStatus(result.status),
    });
  }, [addNovaMessage, effectivePersona, textSessionId]);

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
        disabled={isThinking}
        onListeningChange={setIsListening}
        persona={effectivePersona}
      />
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
    </div>
  );

  const conversationArea = (
    <>
      <div className="mx-auto w-full max-w-2xl">
        <NovaConversation
          messages={messages}
          isThinking={isThinking}
          thinkingStatus={thinkingStatus}
          onConfirmPending={handleConfirmPending}
          onCancelPending={handleCancelPending}
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
    const showCommandOverview = messages.length === 0 && Boolean(lockedPersona);
    const commandOverview = effectivePersona === 'nova'
      ? <NovaCommandOverview onAction={handleSend} status={orbStatus} pulseSignal={speechPulse} />
      : <LegendaryCommandOverview onAction={handleSend} status={orbStatus} pulseSignal={speechPulse} />;

    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <div ref={dockedScrollRef} className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
          <div className={`mx-auto flex w-full flex-col items-center gap-6 ${showCommandOverview ? 'max-w-6xl' : 'max-w-3xl'}`}>
            {/* CONTROL OS — /nova e /legendary agora são ambientes fixos
                (`lockedPersona`) — trocar de identidade é navegar pro
                outro, pelo botão flutuante global (`NovaFloatingLauncher`),
                nunca mais um seletor que muda estado nesta mesma tela. */}
            {!lockedPersona && <NovaPersonaSwitch persona={activePersona} onChange={setActivePersona} />}

            {showCommandOverview ? commandOverview : messages.length === 0 && topContent}

            {/* Tamanho do container é fixo por breakpoint — só o `scale`
                muda — pra não forçar o canvas a recalcular resolução a cada
                resposta. CONTROL OS — Etapa 12: "mobile-first — a esfera
                ocupa praticamente metade da primeira tela ao abrir." `44vh`
                (limitado a 20rem pra não estourar em telas bem altas)
                garante isso sem media query nova — a partir de `sm:` volta
                ao tamanho fixo de desktop. */}
            {!showCommandOverview && (
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

            {!showCommandOverview && messages.length === 0 && belowOrbContent}

            <div className="flex w-full flex-col gap-6">{conversationArea}</div>
          </div>
        </div>
        <div className="shrink-0 border-t border-white/[0.08] bg-bg/85 px-5 py-4 backdrop-blur-xl sm:px-8">
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
      {inputRow}
      {conversationArea}
    </div>
  );
}
