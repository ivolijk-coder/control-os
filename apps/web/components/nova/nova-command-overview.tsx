'use client';

import * as React from 'react';
import { ArrowUpRight, CalendarDays, CheckCircle2, CircleAlert, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useNovaContext } from '@/lib/use-nova-context';
import { toLocalDateString } from '@/services/nova';

interface NovaCommandOverviewProps {
  onAction: (prompt: string) => void;
}

/**
 * A primeira tela da NOVA: uma superfície de decisão, não uma apresentação
 * da IA. Mostra só o que pede atenção e oferece uma próxima ação objetiva.
 */
export function NovaCommandOverview({ onAction }: NovaCommandOverviewProps) {
  const { userName, debts, habits, agendaEvents, missions } = useNovaContext();
  const activeDebt = debts.filter((debt) => debt.remainingAmount > 0);
  const debtTotal = activeDebt.reduce((sum, debt) => sum + debt.remainingAmount, 0);
  const pendingHabits = habits.filter((habit) => !habit.completedToday).length;
  const todayEvents = agendaEvents.filter((event) => event.date === toLocalDateString()).length;
  const missionAtRisk = missions.find((mission) => mission.status === 'em_risco');

  const priority = debtTotal > 0
    ? { eyebrow: 'Fluxo de caixa', title: 'Atenção financeira', detail: `${formatCurrency(debtTotal)} em aberto`, action: 'Organize meu fluxo de caixa' }
    : missionAtRisk
      ? { eyebrow: 'Meta em risco', title: missionAtRisk.title, detail: `${missionAtRisk.progress}% concluída`, action: 'Quero priorizar o que está em risco' }
      : { eyebrow: 'Próxima ação', title: 'Organize o seu dia', detail: 'Sua agenda e prioridades em um só lugar', action: 'Organize meu dia' };

  return (
    <section className="w-full max-w-6xl px-1 pb-8 pt-4 sm:px-4 sm:pt-8">
      <header className="mb-8 flex items-end justify-between gap-5">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-blue">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-blue" /> NOVA · Online
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-text-primary sm:text-4xl">Bom dia, {userName}.</h1>
          <p className="mt-2 text-sm text-text-secondary">Foco no que move seu dia.</p>
        </div>
        <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent-blue/30 bg-accent-blue/10 text-sm font-semibold text-accent-blue sm:flex">
          N
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(17rem,0.75fr)]">
        <section className="rounded-2xl border border-white/[0.09] bg-card/55 p-5 shadow-e2 backdrop-blur-xl sm:p-7">
          <div className="flex items-center gap-2 text-xs font-medium text-text-tertiary">
            <Sparkles className="h-3.5 w-3.5 text-accent-blue" /> Prioridade agora
          </div>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">{priority.eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-text-primary">{priority.title}</h2>
          <p className="mt-2 text-sm text-text-secondary">{priority.detail}</p>
          <button
            type="button"
            onClick={() => onAction(priority.action)}
            className="mt-7 inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2.5 text-sm font-medium text-black transition-transform hover:-translate-y-0.5"
          >
            Ver plano <ArrowUpRight className="h-4 w-4" />
          </button>
        </section>

        <aside className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">Hoje</p>
          <div className="mt-5 flex flex-col divide-y divide-white/[0.07]">
            <button type="button" onClick={() => onAction('Ver meus compromissos de hoje')} className="flex items-center gap-3 py-3 text-left">
              <CalendarDays className="h-4 w-4 text-accent-blue" />
              <span className="flex-1 text-sm text-text-primary">Agenda</span>
              <span className="text-xs text-text-tertiary">{todayEvents === 0 ? 'Livre' : `${todayEvents} hoje`}</span>
            </button>
            <button type="button" onClick={() => onAction('Quero ver meus hábitos pendentes')} className="flex items-center gap-3 py-3 text-left">
              <CheckCircle2 className="h-4 w-4 text-accent-green" />
              <span className="flex-1 text-sm text-text-primary">Hábitos</span>
              <span className="text-xs text-text-tertiary">{pendingHabits === 0 ? 'Em dia' : `${pendingHabits} pendentes`}</span>
            </button>
            <button type="button" onClick={() => onAction('Quero revisar meu fluxo de caixa')} className="flex items-center gap-3 py-3 text-left">
              <CircleAlert className="h-4 w-4 text-accent-red" />
              <span className="flex-1 text-sm text-text-primary">Atenção</span>
              <span className="text-xs text-text-tertiary">{debtTotal > 0 ? 'Financeiro' : 'Nenhuma'}</span>
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
