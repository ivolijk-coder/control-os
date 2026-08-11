'use client';

import * as React from 'react';
import { ArrowUpRight, CalendarDays, CheckCircle2, CircleAlert, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useNovaContext } from '@/lib/use-nova-context';
import { PersonaIdentityMark } from '@/components/nova/persona-identity-mark';
import { toLocalDateString } from '@/services/nova';

interface NovaCommandOverviewProps {
  onAction: (prompt: string) => void;
}

/**
 * A primeira tela da NOVA: uma superfície de decisão, não uma apresentação
 * da IA. Mostra só o que pede atenção e oferece uma próxima ação objetiva.
 *
 * Identidade visual: o círculo do canto exibia a LETRA `N`, escrita à mão no
 * JSX. Uma inicial de fonte fazendo papel de marca — exatamente o que a
 * marca oficial existe para não precisar. Agora é `PersonaIdentityMark`, o
 * mesmo componente e o mesmo asset (`/personas/nova-launcher-c-clean.png`)
 * já usados no seletor e na navegação. Letra é pessoa; símbolo é produto.
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
    <section className="w-full max-w-6xl px-1 pb-4 pt-1 sm:px-4 sm:pb-8 sm:pt-8">
      <header className="mb-5 flex items-end justify-between gap-5 sm:mb-8">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-blue sm:mb-3 sm:text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-blue" /> NOVA · Online
          </div>
          {/* Sem nome ainda (resposta de `/api/auth/me` em voo, ou sessão
              expirada), cumprimenta sem nome — nunca com um inventado. */}
          <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.04em] text-text-primary sm:text-4xl">
            {userName ? `Bom dia, ${userName}.` : 'Bom dia.'}
          </h1>
          <p className="mt-1 text-sm text-text-secondary sm:mt-2">Foco no que move seu dia.</p>
        </div>
        {/* `hidden sm:block` num wrapper, e não na própria marca: `block` e
            `hidden` são a MESMA propriedade no Tailwind, e quem vence não é a
            ordem na string de classes, é a ordem no CSS gerado. Wrapper deixa
            a intenção explícita em vez de depender disso. */}
        <span className="hidden shrink-0 sm:block">
          <PersonaIdentityMark persona="nova" size={40} />
        </span>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(17rem,0.75fr)]">
        <section className="rounded-2xl border border-white/[0.09] bg-card/55 p-5 shadow-e2 backdrop-blur-xl sm:p-7">
          <div className="flex items-center gap-2 text-xs font-medium text-text-tertiary">
            <Sparkles className="h-3.5 w-3.5 text-accent-blue" /> Prioridade agora
          </div>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary sm:mt-6 sm:text-[11px]">{priority.eyebrow}</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-text-primary sm:text-2xl">{priority.title}</h2>
          <p className="mt-1 text-sm text-text-secondary sm:mt-2">{priority.detail}</p>
          <button
            type="button"
            onClick={() => onAction(priority.action)}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2.5 text-sm font-medium text-black transition-transform hover:-translate-y-0.5 sm:mt-7"
          >
            Ver plano <ArrowUpRight className="h-4 w-4" />
          </button>
        </section>

        <aside className="hidden rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5 lg:block">
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
