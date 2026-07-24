'use client';

import { motion } from 'framer-motion';
import { Button, Card } from '@control-os/ui';
import type { NovaMessage } from '@control-os/types';
import { PersonaIdentityMark } from '@/components/nova/persona-identity-mark';

/**
 * Cartão de sugestão da Nova™ no Dashboard Vivo™ — a IA se apresenta como
 * Chief of Staff, não como chatbot. Fase 1: conteúdo mockado, estático.
 */
export function NovaSuggestionCard({ message }: { message: NovaMessage }) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-accent-purple/20 to-transparent blur-3xl" />

      <div className="relative flex items-start gap-3">
        <motion.span
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="flex h-8 w-8 shrink-0 items-center justify-center"
        >
          <PersonaIdentityMark size={28} />
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-accent-purple">Nova sugere</p>
          <p className="mt-1.5 text-sm leading-relaxed text-text-primary">{message.content}</p>
          <div className="mt-4 flex items-center gap-2">
            <Button size="sm">Ver detalhes</Button>
            <Button size="sm" variant="ghost">
              Ignorar
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
