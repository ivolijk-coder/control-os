'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Activity, Target, Wallet } from 'lucide-react';
import { NovaInput } from '@/components/nova/nova-input';
import { NovaConversation } from '@/components/nova/nova-conversation';
import type { ConversationMessage } from '@/components/nova/nova-message-bubble';
import { QuickAction } from '@/components/ui/quick-action';
import { IntelligentPanel } from '@/components/home/intelligent-panel';
import { generateMockNovaReply } from '@/lib/nova-mock-replies';
import { transitionOut } from '@/lib/motion';

const QUICK_ACTIONS = [
  { icon: Target, label: 'Organizar meu dia' },
  { icon: Wallet, label: 'Ver financeiro' },
  { icon: Activity, label: 'Como está minha empresa?' },
] as const;

const THINKING_DELAY_MS = 900;

let messageIdCounter = 0;

/** Gera um id sequencial estável para mensagens da conversa (sem `crypto`). */
function nextMessageId(prefix: string): string {
  messageIdCounter += 1;
  return `${prefix}_${messageIdCounter}`;
}

/**
 * NovaWorkspace — orquestra o Modo de Conversa + Painel inteligente (Nova
 * Experience — Fase 2).
 *
 * Estado local (não persistido): mensagens da sessão, se a NOVA está
 * "pensando", e se o usuário já interagiu ao menos uma vez (o que revela o
 * `IntelligentPanel`, conforme o brief: "Após a conversa aparecer um
 * painel inteligente"). As respostas da NOVA são geradas por
 * `generateMockNovaReply` — casamento local de palavras-chave, não IA real.
 */
export function NovaWorkspace() {
  const [messages, setMessages] = React.useState<ConversationMessage[]>([]);
  const [isThinking, setIsThinking] = React.useState(false);
  const [hasInteracted, setHasInteracted] = React.useState(false);

  const handleSend = React.useCallback((text: string) => {
    const userMessage: ConversationMessage = {
      id: nextMessageId('user'),
      role: 'user',
      content: text,
    };
    setMessages((current) => [...current, userMessage]);
    setIsThinking(true);
    setHasInteracted(true);

    window.setTimeout(() => {
      const reply = generateMockNovaReply(text);
      const novaMessage: ConversationMessage = {
        id: nextMessageId('nova'),
        role: 'nova',
        content: reply.content,
        checklist: reply.checklist,
      };
      setMessages((current) => [...current, novaMessage]);
      setIsThinking(false);
    }, THINKING_DELAY_MS);
  }, []);

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
        <NovaConversation messages={messages} isThinking={isThinking} />
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
