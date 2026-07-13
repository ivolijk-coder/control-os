'use client';

import { Flame, Repeat, Target } from 'lucide-react';
import { Button } from '@control-os/ui';
import { FadeIn } from '@/components/dashboard/fade-in';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/dashboard/section-header';
import { DashboardCard } from '@/components/dashboard/dashboard-card';
import { ChartCard } from '@/components/dashboard/chart-card';
import { MiniBarChart, WeekHeatmap } from '@/components/dashboard/mini-charts';
import { RecommendationCard } from '@/components/dashboard/recommendation-card';
import { ProgressRing } from '@/components/dashboard/progress-ring';
import { useDataStore } from '@/lib/data-store';

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const CHART_ACCENTS = ['purple', 'blue', 'green', 'red'] as const;

function successRate(last7Days: boolean[]): number {
  if (last7Days.length === 0) return 0;
  return (last7Days.filter(Boolean).length / last7Days.length) * 100;
}

/**
 * Hábitos — módulo premium (CONTROL OS — Etapa 10B).
 *
 * `toggleHabitToday` continua sendo a única ação (`useDataStore`, igual
 * antes). "Taxa de sucesso", "score" e "dias ativos" são derivados de
 * `last7Days` — o único histórico que o dado realmente tem; não fabrico um
 * "calendário mensal" porque o modelo de dado só guarda 7 dias por hábito
 * (documentado em `packages/types`), então o heatmap e o gráfico semanal
 * cobrem exatamente o que existe, sem inventar histórico que não há.
 */
export default function HabitosPage() {
  const habits = useDataStore((state) => state.habits);
  const toggleHabitToday = useDataStore((state) => state.toggleHabitToday);

  const completedToday = habits.filter((habit) => habit.completedToday).length;
  const longestStreak = habits.reduce((max, habit) => Math.max(max, habit.streakDays), 0);
  const longestStreakHabit = habits.find((habit) => habit.streakDays === longestStreak);
  const averageSuccessRate =
    habits.length > 0 ? habits.reduce((sum, habit) => sum + successRate(habit.last7Days), 0) / habits.length : 0;

  const weakestHabit = habits.length > 0
    ? habits.reduce((weakest, habit) => (successRate(habit.last7Days) < successRate(weakest.last7Days) ? habit : weakest))
    : null;

  const resumoNova =
    habits.length === 0
      ? 'Nenhum hábito ainda para eu acompanhar.'
      : `${longestStreakHabit ? `Sua maior sequência é "${longestStreakHabit.title}", com ${longestStreak} dia${longestStreak === 1 ? '' : 's'}.` : ''}${
          weakestHabit && successRate(weakestHabit.last7Days) < 50
            ? ` "${weakestHabit.title}" está com taxa de sucesso baixa esta semana — talvez valha retomar hoje.`
            : ''
        }`.trim() || 'Sua semana está equilibrada entre os hábitos.';

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <SectionHeader level="page" title="Hábitos" meta={`${habits.length} acompanhados`} />
      </FadeIn>

      {habits.length === 0 ? (
        <FadeIn delay={0.05}>
          <EmptyState icon={Repeat} title="Nenhum hábito ainda." />
        </FadeIn>
      ) : (
        <>
          <FadeIn delay={0.05}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <DashboardCard icon={Target} label="Concluídos hoje" value={`${completedToday}/${habits.length}`} accent="green" />
              <DashboardCard
                icon={Flame}
                label="Maior sequência"
                value={`${longestStreak} dia${longestStreak === 1 ? '' : 's'}`}
                accent="purple"
              />
              <div className="flex items-center gap-4 rounded-xl border border-white/[0.08] bg-card/60 p-5 shadow-e3 backdrop-blur-md">
                <ProgressRing value={averageSuccessRate} size={52} strokeWidth={5} accent="blue">
                  <span className="font-mono text-xs font-semibold text-text-primary">{Math.round(averageSuccessRate)}%</span>
                </ProgressRing>
                <div className="flex flex-col">
                  <p className="text-xs font-medium text-text-secondary">Score da semana</p>
                  <p className="text-xs text-text-tertiary">Taxa de sucesso média</p>
                </div>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.08}>
            <RecommendationCard text={resumoNova} />
          </FadeIn>

          <FadeIn delay={0.1}>
            <ChartCard title="Últimos 7 dias" description="Um quadrado por dia, por hábito">
              <WeekHeatmap
                dayLabels={WEEKDAY_LABELS}
                rows={habits.map((habit) => ({ id: habit.id, label: habit.title, days: habit.last7Days }))}
              />
            </ChartCard>
          </FadeIn>

          <FadeIn delay={0.13}>
            <ChartCard title="Taxa de sucesso por hábito" description="% de dias concluídos nos últimos 7 dias">
              <MiniBarChart
                data={habits.map((habit, index) => ({
                  label: habit.title,
                  value: successRate(habit.last7Days),
                  displayValue: `${Math.round(successRate(habit.last7Days))}%`,
                  accent: CHART_ACCENTS[index % CHART_ACCENTS.length],
                }))}
              />
            </ChartCard>
          </FadeIn>

          <FadeIn delay={0.16}>
            <div className="flex flex-col gap-3">
              <SectionHeader title="Todos os hábitos" />
              <div className="flex flex-col gap-2">
                {habits.map((habit) => (
                  <div
                    key={habit.id}
                    className="flex items-center gap-4 rounded-xl border border-white/[0.08] bg-card/60 p-4 shadow-e2 backdrop-blur-sm"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="text-sm text-text-primary">{habit.title}</p>
                      <p className="flex items-center gap-1 text-xs text-text-tertiary">
                        <Repeat className="h-3 w-3" />
                        {habit.category} · sequência de {habit.streakDays} dia{habit.streakDays === 1 ? '' : 's'}
                      </p>
                    </div>
                    <Button
                      variant={habit.completedToday ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={() => toggleHabitToday(habit.id)}
                    >
                      {habit.completedToday ? 'Feito hoje' : 'Marcar hoje'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </>
      )}
    </div>
  );
}
