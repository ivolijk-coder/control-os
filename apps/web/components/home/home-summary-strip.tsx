'use client';

import * as React from 'react';
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
 * HomeSummaryStrip — CONTROL OS Etapa 11.
 *
 * O spec pede, depois de "ações rápidas": "resumo financeiro, resumo da
 * agenda, resumo dos hábitos". `NovaWorkspace` (`variant="docked"`) tem o
 * campo de entrada fixo no rodapé — nada pode vir "depois" dele na ordem do
 * documento. Esta faixa resolve a prioridade conceitual do spec (contexto
 * рápido sobre a vida do usuário, sempre visível antes da conversa começar)
 * colocando-a no espaço logo abaixo da esfera, via a nova prop
 * `belowOrbContent` de `NovaWorkspace` — mesmo tratamento de `topContent`
 * (some assim que a conversa começa).
 *
 * Três números, nenhum dado novo: saldo do mês (mesma subtração
 * receita-despesa de `financeiro/page.tsx`), compromissos de hoje (mesmo
 * filtro `event.date === todayIso` de `agenda/page.tsx`) e hábitos pendentes
 * hoje (mesmo campo `completedToday` de `habitos/page.tsx`) — só uma leitura
 * compacta do `NovaContext` real, reaproveitando os mesmos três
 * `DashboardCard`s já usados nos módulos.
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
        <DashboardCard
          icon={Wallet}
          label="Saldo do mês"
          value={formatCurrency(saldo)}
          accent={saldo >= 0 ? 'green' : 'red'}
        />
      </motion.div>
      <motion.div variants={fadeUp}>
        <DashboardCard
          icon={CalendarClock}
          label="Compromissos hoje"
          value={String(compromissosHoje)}
          accent="blue"
        />
      </motion.div>
      <motion.div variants={fadeUp}>
        <DashboardCard
          icon={Repeat}
          label="Hábitos pendentes"
          value={String(habitosPendentes)}
          accent="purple"
        />
      </motion.div>
    </motion.div>
  );
}
