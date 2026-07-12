'use client';

import * as React from 'react';
import { AnimatePresence } from 'framer-motion';
import { NovaMessageBubble, type ConversationMessage } from './nova-message-bubble';
import { NovaThinking } from './nova-thinking';

export interface NovaConversationProps {
  messages: ConversationMessage[];
  isThinking: boolean;
}

/**
 * NovaConversation — Modo de Conversa (Nova Experience — Fase 2).
 *
 * Renderiza as mensagens trocadas com a NOVA nesta sessão (estado local,
 * não persistido, sem abrir novas telas). Some por completo quando não há
 * nenhuma mensagem ainda, para não ocupar espaço na Home antes da primeira
 * interação.
 */
export function NovaConversation({ messages, isThinking }: NovaConversationProps) {
  if (messages.length === 0 && !isThinking) return null;

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence initial={false}>
        {messages.map((message) => (
          <NovaMessageBubble key={message.id} message={message} />
        ))}
        {isThinking && <NovaThinking key="thinking" />}
      </AnimatePresence>
    </div>
  );
}
