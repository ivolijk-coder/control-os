import type { GoalsService } from '@/services/modules';
import { goalsService as defaultGoalsService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { ActionHandler } from '../../action.interfaces';
import { getString } from '../../payload-guards';

/**
 * `task.create` — cria uma `Mission` com `kind: 'lembrete'`
 * (`GoalsService.createMission`, ver `services/modules/goals/goals.types.ts`
 * para o porquê de tarefa e meta compartilharem um Service só).
 */
export class CreateTaskAction implements ActionHandler {
  readonly kind: ActionKind = 'task.create';

  constructor(private readonly goalsService: GoalsService = defaultGoalsService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const title = getString(payload, 'title');
    if (!title) {
      return { success: false, message: 'Não entendi o título da tarefa — preciso de um "title" para criar.' };
    }
    return this.goalsService.createMission({
      title,
      kind: 'lembrete',
      dueDate: getString(payload, 'dueDate'),
    });
  }
}
