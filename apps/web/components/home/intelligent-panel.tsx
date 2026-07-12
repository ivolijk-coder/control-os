'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { MetricCard } from '@/components/dashboard/metric-card';
import { staggerContainer } from '@/lib/motion';
import { MOCK_PAINEL_HOJE } from '@/lib/mock-data';

/**
 * IntelligentPanel — "Painel inteligente" (Nova Experience — Fase 2).
 *
 * Revelado depois da primeira interação com a NOVA no `NovaWorkspace`.
 * Reaproveita `MetricCard` (mesmo cartão já usado no restante da Home) para
 * os 6 indicadores do dia, com entrada em stagger — sem duplicar nenhuma
 * lógica de renderização de cartão.
 */
export function IntelligentPanel() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer(0.06)}
      className="flex flex-col gap-3"
    >
      <h2 className="text-sm font-medium text-text-primary">Painel de hoje</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_PAINEL_HOJE.map((stat) => (
          <MetricCard key={stat.id} stat={stat} />
        ))}
      </div>
    </motion.div>
  );
}
