import type { HabitsService } from '@/services/modules';
import { habitsService as defaultHabitsService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { ActionHandler } from '../../action.interfaces';
import { getBoolean, getNumber, getString } from '../../payload-guards';

export class UpdateHabitAction implements ActionHandler {
  readonly kind: ActionKind = 'habit.update';

  readonly capability: Capability = {
    kind: 'habit.update',
    description: 'Atualiza o progresso de um hábito já existente do usuário (ex.: marcar como feito hoje).',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Identificador do hábito a atualizar.' },
      { name: 'completedToday', type: 'boolean', required: false, description: 'Se o hábito foi cumprido hoje.' },
      { name: 'streakDays', type: 'number', required: false, description: 'Nova sequência de dias consecutivos, se souber.' },
    ],
    examples: [
      'Malhei hoje -> {"kind":"habit.update","confidence":0.8,"parameters":{"id":"habit_1","completedToday":true}}',
    ],
  };

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
