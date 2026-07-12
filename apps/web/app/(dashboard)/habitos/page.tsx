'use client';

import { Button } from '@control-os/ui';
import { FadeIn } from '@/components/dashboard/fade-in';
import { GlassCard } from '@/components/ui/glass-card';
import { ICON_MAP } from '@/components/layout/icon-map';
import { useDataStore } from '@/lib/data-store';
import { cn } from '@/lib/utils';

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/**
 * Hábitos — módulo pessoal (CONTROL OS — Sistema Operacional Pessoal).
 *
 * Acompanhamento visual + sequência (streak), como pedido. `toggleHabitToday`
 * é ação manual direta no `useDataStore` — a Nova ainda não cria/atualiza
 * hábitos por conversa nesta fase (fica pra quando a Memória/intents
 * crescerem); a tela em si já é 100% funcional.
 */
export default function HabitosPage() {
  const habits = useDataStore((state) => state.habits);
  const toggleHabitToday = useDataStore((state) => state.toggleHabitToday);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text-primary">Hábitos</h1>
          <span className="text-xs text-text-tertiary">{habits.length} acompanhados</span>
        </div>
      </FadeIn>

      {habits.length === 0 && (
        <FadeIn delay={0.05}>
          <GlassCard interactive={false} className="p-8 text-center text-sm text-text-secondary">
            Nenhum hábito ainda.
          </GlassCard>
        </FadeIn>
      )}

      <div className="flex flex-col gap-2">
        {habits.map((habit, index) => (
          <FadeIn key={habit.id} delay={0.04 * index}>
            <GlassCard interactive={false} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-sm text-text-primary">{habit.title}</p>
                  <p className="flex items-center gap-1 text-xs text-text-tertiary">
                    <ICON_MAP.Repeat className="h-3 w-3" />
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

              <div className="mt-3 flex items-center gap-1.5">
                {habit.last7Days.map((done, dayIndex) => (
                  <span
                    key={dayIndex}
                    title={WEEKDAY_LABELS[dayIndex]}
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-medium',
                      done ? 'bg-accent-green/20 text-accent-green' : 'bg-white/[0.04] text-text-tertiary'
                    )}
                  >
                    {WEEKDAY_LABELS[dayIndex]}
                  </span>
                ))}
              </div>
            </GlassCard>
          </FadeIn>
        ))}
      </div>
    </div>
  );
}
