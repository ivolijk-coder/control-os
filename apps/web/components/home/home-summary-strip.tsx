'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CalendarClock, Repeat, Wallet } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/dashboard-card';
import { fadeUp, staggerContainer } from '@/lib/motion';
import { useNovaContext } from '@/lib/use-nova-context';
import { formatCurrency } from '@/lib/utils';

/** Mesmo cálculo de "hoje" em ISO (`YYYY-MM-DD`) já usado em `app/(dashboard)/agenda/page.tsx` — nenhuma lógica de data nova. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * HomeSummaryStrip — CONTROL OS Etapa 11; reposicionada como a seção
 * "Módulos" na Etapa 12A ("5. MÓDULOS — somente depois de rolar").
 *
 * Continua vivendo no espaço abaixo da esfera (`belowOrbContent` de
 * `NovaWorkspace`, depois de `HomeTopInsights`) — mas agora, com
 * `HomeTopInsights` cobrindo os insights de destaque, esta faixa passa a
 * ser deliberadamente secundária: um atalho rápido pros 3 módulos com dado
 * mais imediato (Financeiro/Agenda/Hábitos), cada card agora um link
 * direto pro módulo (`next/link`) — nenhuma rota nova, só uma segunda porta
 * de entrada pras mesmas páginas já alcançáveis pela Sidebar.
 *
 * Três números, nenhum dado novo: saldo do mês (mesma subtração
 * receita-despesa de `financeiro/page.tsx`), compromissos de hoje (mesmo
 * filtro `event.date === todayIso` de `agenda/page.tsx`) e hábitos pendentes
 * hoje (mesmo campo `completedToday` de `habitos/page.tsx`).
 */
export function HomeSummaryStrip() {
  const novaContext = useNovaContext();
  const { financeEntries, agendaEvents, habits } = novaContext;

  const saldo = React.useMemo(() => {
    const receitas = financeEntries.filter((entry) => entry.type === 'receita').reduce((sum, entry) => sum + entry.amount, 0);
    const despesas = financeEntries.filter((entry) => entry.type === 'despesa').reduce((sum, entry) => sum + entry.amount, 0);
    return receitas - despesas;
  }, [financeEntries]);

  const compromissosHoje = React.useMemo(() => {
    const today = todayIso();
    return agendaEvents.filter((event) => event.date === today).length;
  }, [agendaEvents]);

  const habitosPendentes = React.useMemo(
    () => habits.filter((habit) => !habit.completedToday).length,
    [habits]
  );

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer(0.06, 0.1)}
      className="grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-3"
    >
      <motion.div variants={fadeUp}>
        <Link href="/financeiro" className="block">
          <DashboardCard
            icon={Wallet}
            label="Saldo do mês"
            value={formatCurrency(saldo)}
            accent={saldo >= 0 ? 'green' : 'red'}
          />
        </Link>
      </motion.div>
      <motion.div variants={fadeUp}>
        <Link href="/agenda" className="block">
          <DashboardCard
            icon={CalendarClock}
            label="Compromissos hoje"
            value={String(compromissosHoje)}
            accent="blue"
          />
        </Link>
      </motion.div>
      <motion.div variants={fadeUp}>
        <Link href="/habitos" className="block">
          <DashboardCard
            icon={Repeat}
            label="Hábitos pendentes"
            value={String(habitosPendentes)}
            accent="purple"
          />
        </Link>
      </motion.div>
    </motion.div>
  );
}
