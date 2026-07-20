import type { Habit } from '@control-os/types';

/**
 * `HabitRepository` — CONTROL OS Fase 6. STUB (ver doc de
 * `CalendarRepository`). Só `update`/`list` — o catálogo de Actions atual
 * não tem `habit.create` (ver `services/modules/habits/habits.types.ts`),
 * então este stub não inventa um método que nada ainda chamaria.
 */
export interface UpdateHabitRecordInput {
  id: string;
  completedToday?: boolean;
  streakDays?: number;
}

export interface HabitRepository {
  update(userId: string, input: UpdateHabitRecordInput): Promise<Habit | undefined>;
  list(userId: string): Promise<Habit[]>;
}
