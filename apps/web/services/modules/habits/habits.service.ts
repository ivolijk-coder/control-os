import type { Habit } from '@control-os/types';
import type { ActionResult } from '@/services/action-result.types';
import type { HabitsService } from './habits.interfaces';
import type { UpdateHabitInput } from './habits.types';

/** Mock em memória — mesmo princípio de `MockFinanceService`, ver aquele arquivo para a justificativa completa. */
export class MockHabitsService implements HabitsService {
  private readonly habits: Habit[] = [
    { id: 'habit_seed_1', title: 'Beber água', category: 'Saúde', streakDays: 3, completedToday: false, last7Days: [true, true, false, true, true, true, false] },
  ];

  async updateHabit(input: UpdateHabitInput): Promise<ActionResult> {
    const habit = this.habits.find((candidate) => candidate.id === input.id);
    if (!habit) {
      return { success: false, message: `Nenhum hábito encontrado com o id "${input.id}".` };
    }
    if (input.completedToday !== undefined) {
      habit.completedToday = input.completedToday;
      // Mantém `last7Days` coerente com `completedToday` — índice 6 é hoje (ver doc de `Habit` em `@control-os/types`).
      habit.last7Days = [...habit.last7Days.slice(1), input.completedToday];
    }
    if (input.streakDays !== undefined) habit.streakDays = input.streakDays;
    return { success: true, message: `Hábito "${habit.title}" atualizado.`, data: habit };
  }
}

export const habitsService: HabitsService = new MockHabitsService();
