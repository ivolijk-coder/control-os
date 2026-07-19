'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Check, Sparkles } from 'lucide-react';
import { Button } from '@control-os/ui';
import type { NovaPersona } from '@/services/nova';
import { cn } from '@/lib/utils';
import { fadeUp, transitionOut } from '@/lib/motion';

/**
 * Status final de uma resposta da NOVA — ver `services/nova/interfaces`
 * (`NovaStatus`). `'pending_confirmation'` (CONTROL OS — Evolução da
 * experiência NOVA) espera uma ação sensível (dívida, despesa/receita de
 * valor alto) ser confirmada ou cancelada pelo usuário antes de executar.
 */
export type ConversationMessageStatus = 'success' | 'error' | 'pending_confirmation';

export interface ConversationMessage {
  id: string;
  role: 'user' | 'nova';
  content: string;
  checklist?: string[];
  /** Só se aplica a mensagens da NOVA já concluídas — ausente enquanto "pensando"/"executando". */
  status?: ConversationMessageStatus;
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
export function NovaMessageBubble({ message, onConfirm, onCancel, persona = 'nova' }: NovaMessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = message.status === 'error';
  const isPendingConfirmation = message.status === 'pending_confirmation';
  const isLegendary = persona === 'legendary';

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
                isLegendary
                ? 'bg-accent-gold/15 text-accent-gold'
                : 'bg-accent-purple/15 text-accent-purple'
          )}
        >
          {isError ? <AlertCircle className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
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
      </div>
    </motion.div>
  );
}
