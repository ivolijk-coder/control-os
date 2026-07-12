'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeUp, transitionOut } from '@/lib/motion';

export interface ConversationMessage {
  id: string;
  role: 'user' | 'nova';
  content: string;
  checklist?: string[];
}

/**
 * NovaMessageBubble — uma mensagem do Modo de Conversa (Nova Experience —
 * Fase 2). Mensagens da NOVA podem trazer um checklist de confirmação
 * (ex.: "✓ missão criada"), sempre mockado — nenhum dado real é alterado.
 */
export function NovaMessageBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      transition={transitionOut()}
      className={cn('flex items-start gap-3', isUser && 'flex-row-reverse')}
    >
      {!isUser && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-purple/15 text-accent-purple">
          <Sparkles className="h-4 w-4" />
        </span>
      )}
      <div
        className={cn(
          'max-w-md rounded-2xl border px-4 py-3 text-sm leading-relaxed backdrop-blur-md',
          isUser
            ? 'border-white/[0.1] bg-white/[0.08] text-text-primary'
            : 'border-white/[0.08] bg-card/60 text-text-primary'
        )}
      >
        <p>{message.content}</p>
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
      </div>
    </motion.div>
  );
}
