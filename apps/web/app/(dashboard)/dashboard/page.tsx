'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Flag,
  Target,
  Wallet,
} from 'lucide-react';
import { MiniSparkline } from '@/components/dashboard/mini-charts';
import { NovaWorkspace } from '@/components/nova/nova-workspace';
import { useDataStore } from '@/lib/data-store';
import { financeEntrySign, formatCurrency } from '@/lib/utils';
import { toLocalDateString } from '@/services/nova';

/**
 * Visão geral do CONTROL OS.
 *
 * Esta página não tenta substituir os módulos Financeiro, Agenda, Metas e
 * Hábitos. Ela responde a uma pergunta mais útil ao abrir o produto:
 * "o que merece minha atenção agora?". A conversa com a NOVA é a ação
 * principal; os dados entram como contexto e cada item leva à sua área
 * completa, sem duplicar tabelas ou formulários na Home.
 */

const CURRENT_MONTH_PREFIX = () => toLocalDateString(new Date()).slice(0, 7);

function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${date}T00:00:00`));
}

interface PriorityItem {
  id: string;
  title: string;
  detail: string;
  href: string;
  tone: 'attention' | 'neutral' | 'positive';
  icon: React.ElementType;
}

const TONE_STYLES: Record<PriorityItem['tone'], string> = {
  attention: 'border-accent-red/20 bg-accent-red/10 text-accent-red',
  neutral: 'border-white/[0.08] bg-white/[0.03] text-text-secondary',
  positive: 'border-accent-green/20 bg-accent-green/10 text-accent-green',
};

export default function DashboardPage() {
  const financeEntries = useDataStore((state) => state.financeEntries);
  const debts = useDataStore((state) => state.debts);
  const agendaEvents = useDataStore((state) => state.agendaEvents);
  const missions = useDataStore((state) => state.missions);

  const financialSnapshot = React.useMemo(() => {
    const monthPrefix = CURRENT_MONTH_PREFIX();
    const currentMonthEntries = financeEntries.filter((entry) => entry.date.startsWith(monthPrefix));
    const income = currentMonthEntries
      .filter((entry) => entry.type === 'receita')
      .reduce((total, entry) => total + entry.amount, 0);
    const expenses = currentMonthEntries
      .filter((entry) => entry.type === 'despesa')
      .reduce((total, entry) => total + entry.amount, 0);

    const chronological = [...financeEntries].sort((a, b) => a.date.localeCompare(b.date));
    let runningBalance = 0;
    const flowValues = chronological.map((entry) => {
      runningBalance += financeEntrySign(entry) * entry.amount;
      return runningBalance;
    });

    return { income, expenses, available: income - expenses, flowValues };
  }, [financeEntries]);

  const openDebts = React.useMemo(
    () => debts.filter((debt) => debt.installmentsPaid < debt.installmentsTotal).sort((a, b) => b.remainingAmount - a.remainingAmount),
    [debts]
  );

  const todayEvents = React.useMemo(() => {
    const today = toLocalDateString(new Date());
    return agendaEvents
      .filter((event) => event.date === today)
      .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
  }, [agendaEvents]);

  const nextEvent = React.useMemo(() => {
    const today = toLocalDateString(new Date());
    return agendaEvents
      .filter((event) => event.date > today)
      .sort((a, b) => `${a.date}T${a.time ?? '00:00'}`.localeCompare(`${b.date}T${b.time ?? '00:00'}`))[0];
  }, [agendaEvents]);

  const atRiskMission = React.useMemo(
    () => missions.find((mission) => mission.status === 'em_risco'),
    [missions]
  );

  const priorities = React.useMemo<PriorityItem[]>(() => {
    const items: PriorityItem[] = [];

    if (openDebts.length > 0) {
      const totalOpen = openDebts.reduce((total, debt) => total + debt.remainingAmount, 0);
      items.push({
        id: 'debts',
        title: `${openDebts.length} compromisso${openDebts.length > 1 ? 's' : ''} financeiro${openDebts.length > 1 ? 's' : ''} em aberto`,
        detail: `${formatCurrency(totalOpen)} para organizar`,
        href: '/financeiro',
        tone: 'attention',
        icon: CircleAlert,
      });
    }

    if (atRiskMission) {
      items.push({
        id: 'mission',
        title: atRiskMission.title,
        detail: `Meta em risco · ${atRiskMission.progress}% concluída`,
        href: '/metas',
        tone: 'attention',
        icon: Target,
      });
    }

    const firstTodayEvent = todayEvents[0];
    if (firstTodayEvent) {
      items.push({
        id: 'agenda-today',
        title: firstTodayEvent.title,
        detail: `${firstTodayEvent.time ?? 'Hoje'} · compromisso de hoje`,
        href: '/agenda',
        tone: 'neutral',
        icon: CalendarDays,
      });
    } else if (nextEvent) {
      items.push({
        id: 'agenda-next',
        title: nextEvent.title,
        detail: `${formatShortDate(nextEvent.date)}${nextEvent.time ? ` · ${nextEvent.time}` : ''}`,
        href: '/agenda',
        tone: 'neutral',
        icon: CalendarDays,
      });
    }

    if (items.length === 0) {
      items.push({
        id: 'clear',
        title: 'Seu dia está organizado',
        detail: 'Use a NOVA para planejar seu próximo passo.',
        href: '/nova',
        tone: 'positive',
        icon: Flag,
      });
    }

    return items.slice(0, 3);
  }, [atRiskMission, nextEvent, openDebts, todayEvents]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-7 sm:px-8 lg:py-9">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.8fr)]">
        <div className="min-w-0">
          <div className="mb-5 max-w-2xl">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-accent-blue">NOVA · online</p>
            <h2 className="text-3xl font-medium tracking-[-0.04em] text-text-primary sm:text-4xl">Pode falar. Eu organizo o resto.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">
              Conte por voz ou escreva o que está acontecendo. A NOVA transforma conversa em ações reais no seu sistema.
            </p>
          </div>

          {/* A conversa é a interface principal: texto e microfone executam
              o mesmo fluxo real da NOVA, não uma simulação visual. */}
          <NovaWorkspace lockedPersona="nova" conversationFirst showQuickActions={false} />
        </div>

        <aside className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-tertiary">Agora</p>
              <h2 className="mt-1 text-lg font-medium text-text-primary">O que exige atenção</h2>
            </div>
            <CircleAlert className="h-5 w-5 text-text-tertiary" />
          </div>

          <div className="divide-y divide-white/[0.06]">
            {priorities.map((priority) => {
              const Icon = priority.icon;
              return (
                <Link key={priority.id} href={priority.href} className="group flex items-center gap-3 py-4 first:pt-1 last:pb-1">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${TONE_STYLES[priority.tone]}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text-primary">{priority.title}</span>
                    <span className="mt-0.5 block text-xs text-text-secondary">{priority.detail}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary" />
                </Link>
              );
            })}
          </div>
        </aside>
      </section>

      <section className="border-y border-white/[0.07] py-6 sm:py-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-tertiary">Visão rápida</p>
            <h2 className="mt-1 text-xl font-medium tracking-[-0.02em] text-text-primary">Financeiro deste mês</h2>
          </div>
          <Link href="/financeiro" className="inline-flex items-center gap-1.5 text-sm text-accent-blue transition-colors hover:text-text-primary">
            Ver detalhes financeiros <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-[repeat(3,minmax(0,1fr))_minmax(220px,1.45fr)]">
          <FinanceMetric label="Entradas" value={formatCurrency(financialSnapshot.income)} tone="positive" />
          <FinanceMetric label="Saídas" value={formatCurrency(financialSnapshot.expenses)} tone="attention" />
          <FinanceMetric label="Disponível" value={formatCurrency(financialSnapshot.available)} tone={financialSnapshot.available >= 0 ? 'positive' : 'attention'} />
          <div className="min-h-24 border-l border-white/[0.07] pl-5 md:col-span-1">
            <div className="mb-2 flex items-center gap-2 text-xs text-text-tertiary"><Wallet className="h-3.5 w-3.5" /> Fluxo acumulado</div>
            <MiniSparkline values={financialSnapshot.flowValues} accent={financialSnapshot.available >= 0 ? 'green' : 'red'} />
          </div>
        </div>
      </section>

    </div>
  );
}

function FinanceMetric({ label, value, tone }: { label: string; value: string; tone: 'positive' | 'attention' }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-text-tertiary">{label}</p>
      <p className={`mt-2 text-2xl font-medium tracking-[-0.03em] ${tone === 'positive' ? 'text-accent-green' : 'text-accent-red'}`}>{value}</p>
    </div>
  );
}
