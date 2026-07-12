'use client';

import { motion } from 'framer-motion';
import { buildTodayHighlights } from '@/services/nova';
import { useDataStore } from '@/lib/data-store';
import { fadeUp, staggerContainer } from '@/lib/motion';

/**
 * TodaySummary — resumo real sob a saudação da Home (CONTROL OS — Etapa 3).
 *
 * "Bom dia, Ivoli. Hoje você possui: • 2 compromissos • ..." — mas em vez
 * de aparecer como mensagem de chat (como era o check-in da Etapa 3.0),
 * agora é um bloco visual estático, direto na estrutura da Home, sempre
 * espelhando o estado atual de `useDataStore`. Some por completo quando
 * não há nenhum destaque real (nada de bullet inventado).
 */
export function TodaySummary() {
  const missions = useDataStore((state) => state.missions);
  const agendaEvents = useDataStore((state) => state.agendaEvents);
  const financeEntries = useDataStore((state) => state.financeEntries);

  const highlights = buildTodayHighlights(missions, agendaEvents, financeEntries);
  if (highlights.length === 0) return null;

  return (
    <motion.ul
      initial="hidden"
      animate="visible"
      variants={staggerContainer(0.05, 0.2)}
      className="mx-auto flex w-full max-w-md flex-col gap-1.5"
    >
      {highlights.map((item) => (
        <motion.li
          key={item}
          variants={fadeUp}
          className="flex items-center justify-center gap-2 text-sm text-text-secondary"
        >
          <span className="h-1 w-1 shrink-0 rounded-full bg-text-tertiary" aria-hidden />
          {item}
        </motion.li>
      ))}
    </motion.ul>
  );
}
