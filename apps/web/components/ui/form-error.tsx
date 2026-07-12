'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { transitionOut } from '@/lib/motion';

/**
 * FormError — microinteração de erro (Nova Experience — Fase 3).
 *
 * Usado em Login e Cadastro no lugar do antigo `<p>` estático. Fecha o
 * requisito "Microinterações: loading, success, erro — tudo animado",
 * que faltava para o caso de erro em todo o app.
 */
export function FormError({ message }: { message: string | null }) {
  return (
    <AnimatePresence mode="wait">
      {message && (
        <motion.div
          key={message}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0, x: [0, -4, 4, -2, 2, 0] }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ ...transitionOut(), x: { duration: 0.4, ease: 'easeOut' } }}
          role="alert"
          className="flex items-center gap-2 rounded-md border border-accent-red/20 bg-accent-red/10 px-3 py-2 text-xs text-accent-red"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
