'use client';

import { ArrowUpRight, BookOpenText, Compass, Flame, Target } from 'lucide-react';
import { useNovaContext } from '@/lib/use-nova-context';

interface LegendaryCommandOverviewProps {
  onAction: (prompt: string) => void;
}

/**
 * Tela de entrada do LEGENDARY. Ele é mentor e estrategista: aponta uma
 * direção e transforma repertório, disciplina e metas em próximos passos.
 */
export function LegendaryCommandOverview({ onAction }: LegendaryCommandOverviewProps) {
  const { userName, habits, missions } = useNovaContext();
  const activeMission = missions.find((mission) => mission.status === 'em_risco')
    ?? missions.find((mission) => mission.status === 'em_andamento')
    ?? missions.find((mission) => mission.status === 'planejamento');
  const activeHabits = habits.filter((habit) => habit.completedToday).length;

  const focus = activeMission
    ? { title: activeMission.title, detail: `${activeMission.progress}% concluída`, action: `Quero uma estratégia para avançar na meta ${activeMission.title}` }
    : { title: 'Defina sua próxima direção', detail: 'Uma meta clara transforma intenção em progresso', action: 'Me ajude a definir minha próxima grande meta' };

  return (
    <section className="w-full max-w-6xl px-1 pb-8 pt-4 sm:px-4 sm:pt-8">
      <header className="mb-8 flex items-end justify-between gap-5">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-gold" /> LEGENDARY · Mentor
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-text-primary sm:text-4xl">Visão para avançar, {userName}.</h1>
          <p className="mt-2 text-sm text-text-secondary">Estratégia, evolução e clareza para sua próxima fase.</p>
        </div>
        <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent-gold/30 bg-accent-gold/10 text-sm font-semibold text-accent-gold sm:flex">
          L
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(17rem,0.75fr)]">
        <section className="rounded-2xl border border-accent-gold/20 bg-card/55 p-5 shadow-e2 backdrop-blur-xl sm:p-7">
          <div className="flex items-center gap-2 text-xs font-medium text-text-tertiary">
            <Compass className="h-3.5 w-3.5 text-accent-gold" /> Foco de evolução
          </div>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">Direção prioritária</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-text-primary">{focus.title}</h2>
          <p className="mt-2 text-sm text-text-secondary">{focus.detail}</p>
          <button
            type="button"
            onClick={() => onAction(focus.action)}
            className="mt-7 inline-flex items-center gap-2 rounded-lg bg-accent-gold px-3.5 py-2.5 text-sm font-medium text-black transition-transform hover:-translate-y-0.5"
          >
            Ver estratégia <ArrowUpRight className="h-4 w-4" />
          </button>
        </section>

        <aside className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">Mentoria</p>
          <div className="mt-5 flex flex-col divide-y divide-white/[0.07]">
            <button type="button" onClick={() => onAction('Me indique um livro para produtividade e diga como aplicar esta semana')} className="flex items-center gap-3 py-3 text-left">
              <BookOpenText className="h-4 w-4 text-accent-gold" />
              <span className="flex-1 text-sm text-text-primary">Leitura</span>
              <span className="text-xs text-text-tertiary">Sugestão</span>
            </button>
            <button type="button" onClick={() => onAction('Quero um plano simples para melhorar minha disciplina esta semana')} className="flex items-center gap-3 py-3 text-left">
              <Flame className="h-4 w-4 text-accent-gold" />
              <span className="flex-1 text-sm text-text-primary">Disciplina</span>
              <span className="text-xs text-text-tertiary">{activeHabits} em dia</span>
            </button>
            <button type="button" onClick={() => onAction('Me ajude a revisar minhas metas e escolher a prioridade da semana')} className="flex items-center gap-3 py-3 text-left">
              <Target className="h-4 w-4 text-accent-gold" />
              <span className="flex-1 text-sm text-text-primary">Metas</span>
              <span className="text-xs text-text-tertiary">Revisar</span>
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
