'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Activity, CalendarClock, Flag, Target, Wallet, type LucideIcon } from 'lucide-react';
import { NovaInput } from '@/components/nova/nova-input';
import { NovaConversation } from '@/components/nova/nova-conversation';
import type { ConversationMessage, ConversationMessageStatus } from '@/components/nova/nova-message-bubble';
import type { NovaThinkingStatus } from '@/components/nova/nova-thinking';
import type { NovaOrbStatus } from '@/components/nova/nova-orb';
import { QuickAction } from '@/components/ui/quick-action';
import { Skeleton } from '@/components/ui/skeleton';
import { IntelligentPanel } from '@/components/home/intelligent-panel';
import { conversationService, KEEP_RECENT_TURNS, shouldCondense } from '@/services/ai';
import { generateRecommendations, toReadOnlyContext } from '@/services/nova';
import type { NovaRecommendationCategory, NovaStatus } from '@/services/nova';
import { useAppStore } from '@/lib/store';
import { useNovaContext } from '@/lib/use-nova-context';
import { transitionOut, transitionSpring } from '@/lib/motion';

// Canvas é inerentemente client-only — mesmo tratamento do BackgroundNetwork.
// `loading` (CONTROL OS — Etapa 10B) evita o "buraco" vazio enquanto o chunk
// do canvas carrega.
const NovaOrb = dynamic(() => import('@/components/nova/nova-orb').then((mod) => mod.NovaOrb), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-full" />,
});

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
};

const SUGGESTION_LABEL_BY_CATEGORY: Record<NovaRecommendationCategory, string> = {
  reduzir_gastos: 'Quer revisar seus gastos deste mês?',
  revisar_gastos: 'Quer revisar essa categoria de gasto?',
  concluir_habitos: 'Quer ver seus hábitos pendentes?',
  reorganizar_agenda: 'Quer reorganizar sua agenda?',
  antecipar_metas: 'Quer antecipar os próximos passos da sua meta?',
  priorizar_tarefas: 'Quer priorizar o que está em risco?',
};

// Nenhuma tela acessa a IA diretamente (CONTROL OS — Preparação para OpenAI
// GPT-5.5): o único jeito de conversar com a NOVA é através do
// `ConversationService`, que por sua vez decide o `AIProvider` internamente
// (`services/ai/config.ts`). Desde a Etapa 8, `conversationService` é o
// singleton compartilhado exportado por `services/ai` — não uma instância
// própria deste componente — porque o Modo Conversa por voz é um segundo
// consumidor que precisa enxergar a mesma confirmação de ação sensível
// pendente (`pendingBySession`) que a conversa por texto.

const THINKING_DELAY_MS = 700;
const EXECUTING_DELAY_MS = 500;

let messageIdCounter = 0;

/** Gera um id sequencial estável para mensagens da conversa (sem `crypto`). */
function nextMessageId(prefix: string): string {
  messageIdCounter += 1;
  return `${prefix}_${messageIdCounter}`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
}

/**
 * NovaWorkspace — orquestra o Modo de Conversa (Nova Experience — Fase 2),
 * executando ações reais contra `useDataStore` via `processNovaTurn`
 * (CONTROL OS 3.0/Etapa 3) em vez de um gerador de respostas mockado local.
 *
 * A Home (`variant="docked"`) é propositalmente limpa — objetivo declarado
 * pelo usuário: "só a bola no meio", sem painéis, sensação de estar
 * conversando com alguém. A `NovaOrb` fica sempre visível (não some depois
 * da primeira mensagem) e cresce (`scale`) conforme o estado da conversa —
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
}: NovaWorkspaceProps) {
  // Vive no `useAppStore` (não mais `useState` local) — sobrevive a
  // fechar/reabrir o painel flutuante. Ver comentário em `lib/store.ts`.
  const messages = useAppStore((state) => state.novaMessages);
  const addNovaMessage = useAppStore((state) => state.addNovaMessage);
  const replaceNovaMessages = useAppStore((state) => state.replaceNovaMessages);
  const [isThinking, setIsThinking] = React.useState(false);
  const [thinkingStatus, setThinkingStatus] = React.useState<NovaThinkingStatus>('pensando');

  // CONTROL OS — Etapa 8: extraído para `useNovaContext` (`lib/`) — o novo
  // Modo Conversa por voz (`NovaVoiceOverlay`) precisa do mesmo `NovaContext`
  // real, e duplicar esta montagem em dois lugares arriscaria os dois
  // divergirem com o tempo.
  const novaContext = useNovaContext();

  /**
   * Sugestões da Home (CONTROL OS — Etapa 9): "nunca sugestões aleatórias,
   * sempre baseadas nos dados" — reaproveita o Recommendation Engine
   * (`generateRecommendations`, Etapa 7) em vez do `QUICK_ACTIONS` estático.
   * Cai de volta pro `QUICK_ACTIONS` só quando não há nenhuma recomendação
   * real ainda (usuário novo, sem dados suficientes).
   */
  const suggestions = React.useMemo(() => {
    const recommendations = generateRecommendations(toReadOnlyContext(novaContext));
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
    const latest = useAppStore.getState().novaMessages;
    if (!shouldCondense(latest.length)) return;

    const older = latest.slice(0, latest.length - KEEP_RECENT_TURNS);
    const recent = latest.slice(latest.length - KEEP_RECENT_TURNS);

    void conversationService.summarizeOlderTurns(older).then((summaryText) => {
      replaceNovaMessages([
        {
          id: nextMessageId('summary'),
          role: 'nova',
          content: `Resumo da conversa anterior: ${summaryText}`,
          status: 'success',
        },
        ...recent,
      ]);
    });
  }, [replaceNovaMessages]);

  const handleSend = React.useCallback(
    (text: string) => {
      const userMessage: ConversationMessage = {
        id: nextMessageId('user'),
        role: 'user',
        content: text,
      };
      addNovaMessage(userMessage);
      setIsThinking(true);
      setThinkingStatus('pensando');

      void (async () => {
        await wait(THINKING_DELAY_MS);
        setThinkingStatus('executando');
        await wait(EXECUTING_DELAY_MS);

        const result = await conversationService.processTurn(text, novaContext);
        addNovaMessage({
          id: nextMessageId('nova'),
          role: 'nova',
          content: result.reply,
          checklist: result.checklist,
          status: resultStatusToMessageStatus(result.status),
        });
        setIsThinking(false);
        maybeCondenseConversation();
      })();
    },
    [novaContext, addNovaMessage, maybeCondenseConversation]
  );

  const handleConfirmPending = React.useCallback(() => {
    setIsThinking(true);
    setThinkingStatus('executando');

    void (async () => {
      await wait(EXECUTING_DELAY_MS);
      const result = await conversationService.confirmPending(novaContext);
      addNovaMessage({
        id: nextMessageId('nova'),
        role: 'nova',
        content: result.reply,
        checklist: result.checklist,
        status: resultStatusToMessageStatus(result.status),
      });
      setIsThinking(false);
      maybeCondenseConversation();
    })();
  }, [novaContext, addNovaMessage, maybeCondenseConversation]);

  const handleCancelPending = React.useCallback(() => {
    const result = conversationService.cancelPending();
    addNovaMessage({
      id: nextMessageId('nova'),
      role: 'nova',
      content: result.reply,
      status: resultStatusToMessageStatus(result.status),
    });
  }, [addNovaMessage]);

  const orbStatus: NovaOrbStatus = isThinking ? thinkingStatus : 'idle';
  // A esfera "cresce" enquanto a NOVA pensa/executa — a reação visual que
  // substitui, por enquanto, uma resposta em voz real.
  const orbScale = orbStatus === 'executando' ? 1.18 : orbStatus === 'pensando' ? 1.08 : 1;

  const inputRow = (
    <div className="mx-auto w-full max-w-2xl">
      <NovaInput onSubmit={handleSend} disabled={isThinking} />
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
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6">
            {messages.length === 0 && topContent}

            {/* Tamanho do container é fixo — só o `scale` muda — pra não
                forçar o canvas a recalcular resolução a cada resposta. */}
            <motion.div
              animate={{ scale: orbScale }}
              transition={transitionSpring}
              className="flex h-64 w-64 shrink-0 items-center justify-center sm:h-80 sm:w-80"
            >
              {/* CONTROL OS — Etapa 9: "NOVA ORB. Grande. Viva. Respirando."
                  A respiração em si vem de dentro da própria `NovaOrb` desde
                  a Etapa 10A (overhaul visual) — não precisa mais de uma
                  classe CSS externa aqui. */}
              <NovaOrb status={orbStatus} />
            </motion.div>

            <div className="flex w-full flex-col gap-6">{conversationArea}</div>
          </div>
        </div>
        <div className="shrink-0 border-t border-white/[0.08] bg-bg/70 px-6 py-4 backdrop-blur-xl">
          {inputRow}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {inputRow}
      {conversationArea}
    </div>
  );
}
