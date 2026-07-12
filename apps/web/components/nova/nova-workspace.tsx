'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Activity, CalendarClock, Flag, Target, Wallet } from 'lucide-react';
import { NovaInput } from '@/components/nova/nova-input';
import { NovaConversation } from '@/components/nova/nova-conversation';
import type { ConversationMessage } from '@/components/nova/nova-message-bubble';
import type { NovaThinkingStatus } from '@/components/nova/nova-thinking';
import type { NovaOrbStatus } from '@/components/nova/nova-orb';
import { QuickAction } from '@/components/ui/quick-action';
import { IntelligentPanel } from '@/components/home/intelligent-panel';
import { processNovaTurn } from '@/services/nova';
import type { NovaContext } from '@/services/nova';
import { useDataStore } from '@/lib/data-store';
import { transitionOut, transitionSpring } from '@/lib/motion';

// Canvas é inerentemente client-only — mesmo tratamento do BackgroundNetwork.
const NovaOrb = dynamic(() => import('@/components/nova/nova-orb').then((mod) => mod.NovaOrb), {
  ssr: false,
});

const QUICK_ACTIONS = [
  { icon: Target, label: 'Organize meu dia' },
  { icon: Activity, label: 'Como está minha empresa?' },
  { icon: Wallet, label: 'Gastei dinheiro' },
  { icon: Flag, label: 'Criar uma meta' },
  { icon: CalendarClock, label: 'Ver meus compromissos' },
] as const;

// Sem seletor de Space na conversa ainda — toda ação criada pela Nova cai
// num Space padrão. Trocado de "Minha Empresa" para "Minha Vida" no Sistema
// Operacional Pessoal: o foco deixa de ser empresa, passa a ser a vida do
// usuário — reflete isso também nos dados que a Nova cria por conversa,
// não só na interface.
const DEFAULT_SPACE_ID = 'sp_vida';

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
 * Estado local (não persistido): mensagens da sessão e o estado da Nova
 * (pensando/executando). "Primeiro faz. Depois responde." — o
 * plano/checklist e a execução real sempre rodam antes da resposta em
 * texto aparecer.
 */
export function NovaWorkspace({
  showIntelligentPanel = false,
  variant = 'inline',
  topContent,
}: NovaWorkspaceProps) {
  const [messages, setMessages] = React.useState<ConversationMessage[]>([]);
  const [isThinking, setIsThinking] = React.useState(false);
  const [thinkingStatus, setThinkingStatus] = React.useState<NovaThinkingStatus>('pensando');

  const addMission = useDataStore((state) => state.addMission);
  const updateMission = useDataStore((state) => state.updateMission);
  const addTimelineEvent = useDataStore((state) => state.addTimelineEvent);
  const addFinanceEntry = useDataStore((state) => state.addFinanceEntry);
  const addAgendaEvent = useDataStore((state) => state.addAgendaEvent);
  const addDebt = useDataStore((state) => state.addDebt);
  const debts = useDataStore((state) => state.debts);
  const missions = useDataStore((state) => state.missions);
  const agendaEvents = useDataStore((state) => state.agendaEvents);
  const financeEntries = useDataStore((state) => state.financeEntries);
  const habits = useDataStore((state) => state.habits);

  // As actions do Zustand são referências estáveis entre renders. Os
  // snapshots de leitura (debts, missions, agendaEvents, financeEntries,
  // habits) não são — mudam a cada criação/edição — então este memo passa a
  // recalcular nesses momentos (correto: intents de consulta como "quanto
  // eu devo" ou "o que preciso fazer hoje" precisam sempre do snapshot mais
  // recente).
  const novaContext: NovaContext = React.useMemo(
    () => ({
      actions: { addMission, updateMission, addTimelineEvent, addFinanceEntry, addAgendaEvent, addDebt },
      defaultSpaceId: DEFAULT_SPACE_ID,
      debts,
      missions,
      agendaEvents,
      financeEntries,
      habits,
    }),
    [
      addMission,
      updateMission,
      addTimelineEvent,
      addFinanceEntry,
      addAgendaEvent,
      addDebt,
      debts,
      missions,
      agendaEvents,
      financeEntries,
      habits,
    ]
  );

  const handleSend = React.useCallback(
    (text: string) => {
      const userMessage: ConversationMessage = {
        id: nextMessageId('user'),
        role: 'user',
        content: text,
      };
      setMessages((current) => [...current, userMessage]);
      setIsThinking(true);
      setThinkingStatus('pensando');

      void (async () => {
        await wait(THINKING_DELAY_MS);
        setThinkingStatus('executando');
        await wait(EXECUTING_DELAY_MS);

        const result = await processNovaTurn(text, novaContext);
        const novaMessage: ConversationMessage = {
          id: nextMessageId('nova'),
          role: 'nova',
          content: result.reply,
          checklist: result.checklist,
          status: result.status === 'erro' ? 'error' : 'success',
        };
        setMessages((current) => [...current, novaMessage]);
        setIsThinking(false);
      })();
    },
    [novaContext]
  );

  const orbStatus: NovaOrbStatus = isThinking ? thinkingStatus : 'idle';
  // A esfera "cresce" enquanto a NOVA pensa/executa — a reação visual que
  // substitui, por enquanto, uma resposta em voz real.
  const orbScale = orbStatus === 'executando' ? 1.18 : orbStatus === 'pensando' ? 1.08 : 1;

  const inputRow = (
    <div className="mx-auto w-full max-w-2xl">
      <NovaInput onSubmit={handleSend} disabled={isThinking} />
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {QUICK_ACTIONS.map((action) => (
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
        <NovaConversation messages={messages} isThinking={isThinking} thinkingStatus={thinkingStatus} />
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
