import type { HabitsService } from '@/services/modules';
import { habitsService as defaultHabitsService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { ActionHandler } from '../../action.interfaces';
import { getBoolean, getNumber, getString } from '../../payload-guards';

export class UpdateHabitAction implements ActionHandler {
  readonly kind: ActionKind = 'habit.update';

  constructor(private readonly habitsService: HabitsService = defaultHabitsService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const id = getString(payload, 'id');
    if (!id) {
      return { success: false, message: 'Preciso do "id" do hábito para atualizá-lo.' };
    }
    return this.habitsService.updateHabit({
      id,
      completedToday: getBoolean(payload, 'completedToday'),
      streakDays: getNumber(payload, 'streakDays'),
    });
  }
}
