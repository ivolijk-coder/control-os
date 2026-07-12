'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { MetricCard } from '@/components/dashboard/metric-card';
import { staggerContainer } from '@/lib/motion';
import { MOCK_PAINEL_HOJE } from '@/lib/mock-data';
import { buildLiveDashboardStats } from '@/lib/derived-stats';
import { useDataStore } from '@/lib/data-store';

// Clientes e Projetos não têm domínio próprio em useDataStore ainda —
// continuam vindo do mock; os outros 4 tiles já são derivados de dados reais.
const STATIC_STAT_IDS = new Set(['painel_clientes', 'painel_projetos']);

/**
 * IntelligentPanel — "Painel inteligente" (Nova Experience — Fase 2).
 *
 * Revelado depois da primeira interação com a NOVA no `NovaWorkspace`.
 * Reaproveita `MetricCard` (mesmo cartão já usado no restante da Home) para
 * os indicadores do dia. Desde o CONTROL OS 3.0, Receita/Gastos/Missões/
 * Agenda são derivados de `useDataStore` — a mesma fonte que a navegação
 * manual usa — em vez de totalmente mockados.
 */
export function IntelligentPanel() {
  const missions = useDataStore((state) => state.missions);
  const financeEntries = useDataStore((state) => state.financeEntries);
  const agendaEvents = useDataStore((state) => state.agendaEvents);

  const liveStats = buildLiveDashboardStats(missions, financeEntries, agendaEvents);
  const staticStats = MOCK_PAINEL_HOJE.filter((stat) => STATIC_STAT_IDS.has(stat.id));
  const stats = [...liveStats, ...staticStats];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer(0.06)}
      className="flex flex-col gap-3"
    >
      <h2 className="text-sm font-medium text-text-primary">Painel de hoje</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <MetricCard key={stat.id} stat={stat} />
        ))}
      </div>
    </motion.div>
  );
}
