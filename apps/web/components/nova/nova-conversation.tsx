'use client';

import * as React from 'react';
import { AnimatePresence } from 'framer-motion';
import { NovaMessageBubble, type ConversationMessage } from './nova-message-bubble';
import { NovaThinking, type NovaThinkingStatus } from './nova-thinking';

export interface NovaConversationProps {
  messages: ConversationMessage[];
  isThinking: boolean;
  /** "Pensando" (interpretando) vs. "Executando" (rodando ações reais no useDataStore). */
  thinkingStatus?: NovaThinkingStatus;
  /**
   * Handlers dos botões Confirmar/Cancelar (CONTROL OS — Evolução da
   * experiência NOVA) — plugados só na ÚLTIMA mensagem quando ela está
   * `'pending_confirmation'`. Mensagens antigas nunca recebem os handlers,
   * mesmo que também tenham passado por esse status — assim que uma
   * mensagem nova aparece depois, a pendência anterior já foi resolvida.
   */
  onConfirmPending?: () => void;
  onCancelPending?: () => void;
}

/**
 * NovaConversation — Modo de Conversa (Nova Experience — Fase 2, estendida
 * no CONTROL OS 3.0 com os estados "Pensando"/"Executando", e na Evolução
 * da experiência NOVA com confirmação de ações sensíveis).
 *
 * Renderiza as mensagens trocadas com a NOVA (histórico agora vive no
 * `useAppStore`, sobrevive a fechar/reabrir o painel flutuante — ver
 * `lib/store.ts`). Some por completo quando não há nenhuma mensagem ainda,
 * para não ocupar espaço na Home antes da primeira interação.
 */
export function NovaConversation({
  messages,
  isThinking,
  thinkingStatus,
  onConfirmPending,
  onCancelPending,
}: NovaConversationProps) {
  if (messages.length === 0 && !isThinking) return null;

  const lastMessageId = messages.length > 0 ? messages[messages.length - 1]?.id : undefined;

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence initial={false}>
        {messages.map((message) => (
          <NovaMessageBubble
            key={message.id}
            message={message}
            onConfirm={message.id === lastMessageId ? onConfirmPending : undefined}
            onCancel={message.id === lastMessageId ? onCancelPending : undefined}
          />
        ))}
        {isThinking && <NovaThinking key="thinking" status={thinkingStatus} />}
      </AnimatePresence>
    </div>
  );
}
