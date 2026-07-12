'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Activity, CalendarClock, Flag, Target, Wallet } from 'lucide-react';
import { NovaInput } from '@/components/nova/nova-input';
import { NovaConversation } from '@/components/nova/nova-conversation';
import type { ConversationMessage } from '@/components/nova/nova-message-bubble';
import type { NovaThinkingStatus } from '@/components/nova/nova-thinking';
import { QuickAction } from '@/components/ui/quick-action';
import { IntelligentPanel } from '@/components/home/intelligent-panel';
import { buildDailyCheckIn, processNovaTurn } from '@/services/nova';
import type { NovaContext } from '@/services/nova';
import { useDataStore } from '@/lib/data-store';
import { transitionOut } from '@/lib/motion';

const CHECKIN_STORAGE_KEY = 'control-os-nova-checkin-shown';

const QUICK_ACTIONS = [
  { icon: Target, label: 'Organize meu dia' },
  { icon: Activity, label: 'Como está minha empresa?' },
  { icon: Wallet, label: 'Gastei dinheiro' },
  { icon: Flag, label: 'Criar uma meta' },
  { icon: CalendarClock, label: 'Ver meus compromissos' },
] as const;

// Fase 1 (arquitetura, CONTROL OS 3.0): sem seletor de Space na conversa
// ainda — toda ação criada pela Nova cai no Space "Minha Empresa" por
// padrão, mesmo Space usado nos dados mockados de exemplo.
const DEFAULT_SPACE_ID = 'sp_empresa';

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
 * NovaWorkspace — orquestra o Modo de Conversa + Painel inteligente
 * (Nova Experience — Fase 2), agora executando ações reais contra
 * `useDataStore` via `processNovaTurn` (CONTROL OS 3.0) em vez de um
 * gerador de respostas mockado local.
 *
 * Estado local (não persistido): mensagens da sessão, estado da Nova
 * (pensando/executando), e se o usuário já interagiu ao menos uma vez (o
 * que revela o `IntelligentPanel`). "Primeiro faz. Depois responde." — o
 * plano/checklist e a execução real sempre rodam antes da resposta em
 * texto aparecer.
 *
 * `dailyCheckIn`: quando `true` (usado só na Home `/nova`), a Nova abre a
 * conversa proativamente com um resumo real do dia — uma vez por sessão do
 * navegador (guardado em `sessionStorage`), não a cada render.
 */
export function NovaWorkspace({ dailyCheckIn = false }: { dailyCheckIn?: boolean }) {
  const [messages, setMessages] = React.useState<ConversationMessage[]>([]);
  const [isThinking, setIsThinking] = React.useState(false);
  const [thinkingStatus, setThinkingStatus] = React.useState<NovaThinkingStatus>('pensando');
  const [hasInteracted, setHasInteracted] = React.useState(false);

  const addMission = useDataStore((state) => state.addMission);
  const updateMission = useDataStore((state) => state.updateMission);
  const addTimelineEvent = useDataStore((state) => state.addTimelineEvent);
  const addFinanceEntry = useDataStore((state) => state.addFinanceEntry);
  const addAgendaEvent = useDataStore((state) => state.addAgendaEvent);

  React.useEffect(() => {
    if (!dailyCheckIn) return;
    if (window.sessionStorage.getItem(CHECKIN_STORAGE_KEY)) return;
    window.sessionStorage.setItem(CHECKIN_STORAGE_KEY, '1');

    const { missions, agendaEvents, financeEntries } = useDataStore.getState();
    const summary = buildDailyCheckIn(missions, agendaEvents, financeEntries);
    setMessages((current) => [
      ...current,
      { id: nextMessageId('nova'), role: 'nova', content: summary, status: 'success' },
    ]);
    setHasInteracted(true);
  }, [dailyCheckIn]);

  // As actions do Zustand são referências estáveis entre renders — este
  // memo praticamente só roda uma vez, sem recriar o contexto a cada
  // digitação do usuário.
  const novaContext: NovaContext = React.useMemo(
    () => ({
      actions: { addMission, updateMission, addTimelineEvent, addFinanceEntry, addAgendaEvent },
      defaultSpaceId: DEFAULT_SPACE_ID,
    }),
    [addMission, updateMission, addTimelineEvent, addFinanceEntry, addAgendaEvent]
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
      setHasInteracted(true);

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

  return (
    <div className="flex w-full flex-col gap-6">
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

      <div className="mx-auto w-full max-w-2xl">
        <NovaConversation messages={messages} isThinking={isThinking} thinkingStatus={thinkingStatus} />
      </div>

      {hasInteracted && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitionOut(0.4)}
        >
          <IntelligentPanel />
        </motion.div>
      )}
    </div>
  );
}
