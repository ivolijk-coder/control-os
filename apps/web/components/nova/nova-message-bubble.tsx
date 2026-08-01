'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Check } from 'lucide-react';
import { Button } from '@control-os/ui';
import type { NovaPersona } from '@/services/nova';
import { cn } from '@/lib/utils';
import { fadeUp, transitionOut } from '@/lib/motion';
import { PersonaIdentityMark } from '@/components/nova/persona-identity-mark';

/**
 * Status final de uma resposta da NOVA — ver `services/nova/interfaces`
 * (`NovaStatus`). `'pending_confirmation'` (CONTROL OS — Evolução da
 * experiência NOVA) espera uma ação sensível (dívida, despesa/receita de
 * valor alto) ser confirmada ou cancelada pelo usuário antes de executar.
 */
export type ConversationMessageStatus = 'success' | 'error' | 'pending_confirmation';

/**
 * Botão genérico de uma `ConversationTask` (Fase D — "NOVA como centro da
 * experiência"). `id`/`label` vêm de quem criou a task (ex.:
 * `buildDocumentConversationTaskContent`, em `services/documents`) — este
 * componente nunca sabe o que cada `id` significa, só repassa de volta em
 * `onTaskAction`. Nenhum campo aqui é específico de Documentos ou de
 * qualquer outro produtor: o mesmo shape serve pra email, PIX, fatura,
 * viagem, meta ou qualquer `ConversationTask` futura.
 */
export type ConversationMessageAction = { id: string; label: string };

export interface ConversationMessage {
  id: string;
  role: 'user' | 'nova';
  content: string;
  checklist?: string[];
  /** Só se aplica a mensagens da NOVA já concluídas — ausente enquanto "pensando"/"executando". */
  status?: ConversationMessageStatus;
  /** Arquivo privado que a NOVA encontrou para o usuário baixar. */
  attachment?: { label: string; href: string };
  /**
   * Presente só em mensagens que apresentam uma `ConversationTask` ainda
   * pendente (Fase D). `taskId` é o id real da task (nunca o `id` desta
   * mensagem/bolha, que é só uma chave de render) — `onTaskAction`/
   * `onDismissTask` o devolvem pra quem chama saber qual task resolver.
   */
  taskId?: string;
  /** Ações específicas da task, além do botão genérico "Depois" que a própria bolha já oferece. */
  taskActions?: ConversationMessageAction[];
}

export interface NovaMessageBubbleProps {
  message: ConversationMessage;
  /**
   * Só passado pela última mensagem da conversa quando ela está
   * `'pending_confirmation'` (CONTROL OS — Evolução da experiência NOVA) —
   * mensagens antigas nunca mostram os botões, mesmo que também tenham
   * ficado com esse status um dia (a pendência anterior já foi resolvida
   * assim que uma mensagem nova apareceu depois dela).
   */
  onConfirm?: () => void;
  onCancel?: () => void;
  /**
   * Botões de `message.taskActions` (Fase D). Diferente de
   * `onConfirm`/`onCancel` (binário, só a última mensagem, um único
   * `PendingTurn` por sessão em `ConversationService`), várias
   * `ConversationTask`s podem estar pendentes ao mesmo tempo — cada bolha
   * que tem `taskId` recebe o handler, não só a última.
   */
  onTaskAction?: (taskId: string, actionId: string) => void;
  /** Botão "Depois" — sempre disponível em qualquer bolha com `taskId`, nunca parte de `taskActions`. */
  onDismissTask?: (taskId: string) => void;
  /**
   * Identidade que respondeu esta mensagem (CONTROL OS — Etapa 16E). Colore
   * só o avatar da NOVA (roxo/dourado) — nunca a bolha em si, que continua
   * neutra (`bg-card/60`) independente de quem respondeu. Padrão `'nova'`
   * por retrocompatibilidade com qualquer chamador que ainda não passe a
   * prop.
   */
  persona?: NovaPersona;
}

/**
 * NovaMessageBubble — uma mensagem do Modo de Conversa (Nova Experience —
 * Fase 2, estendida no CONTROL OS 3.0 com estado de erro, e na Evolução da
 * experiência NOVA com confirmação de ações sensíveis). Mensagens da NOVA
 * podem trazer um checklist de confirmação (ex.: "✓ missão criada") ou,
 * quando `status === 'pending_confirmation'`, botões de Confirmar/Cancelar.
 * Quando `status === 'error'`, reaproveita o padrão visual de `FormError`
 * (borda/fundo vermelhos + microinteração de shake).
 */
export function NovaMessageBubble({ message, onConfirm, onCancel, onTaskAction, onDismissTask, persona = 'nova' }: NovaMessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = message.status === 'error';
  const isPendingConfirmation = message.status === 'pending_confirmation';
  const isLegendary = persona === 'legendary';
  const hasTaskActions = Boolean(message.taskId) && (onTaskAction || onDismissTask);

  return (
    <motion.div
      initial="hidden"
      animate={isError ? { opacity: 1, y: 0, x: [0, -4, 4, -2, 2, 0] } : 'visible'}
      variants={fadeUp}
      transition={
        isError ? { ...transitionOut(), x: { duration: 0.4, ease: 'easeOut' } } : transitionOut()
      }
      className={cn('flex items-start gap-3', isUser && 'flex-row-reverse')}
    >
      {!isUser && (
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
            isError
              ? 'bg-accent-red/15 text-accent-red'
              : // CONTROL OS — Etapa 16E: o avatar da NOVA reflete quem
                // respondeu (roxo/dourado) — a mesma dualidade que já existe
                // na Orb e no seletor, agora também na conversa em texto.
                'bg-transparent'
          )}
        >
          {isError ? <AlertCircle className="h-4 w-4" /> : <PersonaIdentityMark persona={isLegendary ? 'legendary' : 'nova'} size={28} />}
        </span>
      )}
      <div
        className={cn(
          'max-w-md rounded-2xl border px-4 py-3 text-sm leading-relaxed backdrop-blur-md',
          isUser && 'border-white/[0.1] bg-white/[0.08] text-text-primary',
          !isUser && !isError && 'border-white/[0.08] bg-card/60 text-text-primary',
          !isUser && isError && 'border-accent-red/20 bg-accent-red/10 text-text-primary'
        )}
      >
        <p className="whitespace-pre-line">{message.content}</p>
        {message.attachment && (
          <a
            href={message.attachment.href}
            className="mt-3 inline-flex rounded-lg border border-accent-blue/30 bg-accent-blue/10 px-3 py-1.5 text-xs font-medium text-accent-blue transition-colors hover:bg-accent-blue/20"
          >
            Baixar {message.attachment.label}
          </a>
        )}
        {message.checklist && message.checklist.length > 0 && (
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {message.checklist.map((item) => (
              <li key={item} className="flex items-center gap-1.5 text-xs text-accent-green">
                <Check className="h-3 w-3 shrink-0" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        )}
        {isPendingConfirmation && (onConfirm || onCancel) && (
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" variant="primary" onClick={onConfirm}>
              Confirmar
            </Button>
            <Button size="sm" variant="secondary" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        )}
        {hasTaskActions && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {message.taskActions?.map((action, index) => (
              <Button
                key={action.id}
                size="sm"
                variant={index === 0 ? 'primary' : 'secondary'}
                onClick={() => onTaskAction?.(message.taskId as string, action.id)}
              >
                {action.label}
              </Button>
            ))}
            <Button size="sm" variant="secondary" onClick={() => onDismissTask?.(message.taskId as string)}>
              Depois
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
