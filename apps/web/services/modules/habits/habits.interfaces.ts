import type { ActionResult } from '@/services/action-result.types';
import type { UpdateHabitInput } from './habits.types';

export interface HabitsService {
  updateHabit(input: UpdateHabitInput): Promise<ActionResult>;
}
