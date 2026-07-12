'use client';

import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { hoverLift } from '@/lib/motion';

// Escondido em /nova: a conversa já é o conteúdo principal dessa tela — não
// faz sentido empilhar duas superfícies de conversa uma sobre a outra.
const HIDDEN_ON_PREFIXES = ['/nova'];

/**
 * NovaFloatingLauncher — botão flutuante permanente da Nova
 * (CONTROL OS — Etapa 3).
 *
 * "A IA deve acompanhar o usuário em qualquer módulo." Canto inferior
 * direito, desktop e mobile, sempre visível por cima do conteúdo da
 * página. Abre o `NovaFloatingPanel` sem navegar para nenhuma rota.
 */
export function NovaFloatingLauncher() {
  const pathname = usePathname();
  const setNovaPanelOpen = useAppStore((state) => state.setNovaPanelOpen);

  if (pathname && HIDDEN_ON_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <motion.button
      type="button"
      onClick={() => setNovaPanelOpen(true)}
      aria-label="Conversar com a Nova"
      className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-accent-purple text-white shadow-e5 backdrop-blur-md"
      {...hoverLift}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <Sparkles className="h-6 w-6" />
    </motion.button>
  );
}
