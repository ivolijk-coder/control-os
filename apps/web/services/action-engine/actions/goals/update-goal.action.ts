import type { MissionStatus } from '@control-os/types';
import type { GoalsService } from '@/services/modules';
import { goalsService as defaultGoalsService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { ActionHandler } from '../../action.interfaces';
import { getNumber, getString } from '../../payload-guards';

/** Narrowing específico de domínio (não genérico o bastante pra `payload-guards.ts`) — mesmo padrão de `isNovaFactCategory` em `services/nova/memory`. */
function isMissionStatus(value: string): value is MissionStatus {
  return value === 'planejamento' || value === 'em_andamento' || value === 'em_risco' || value === 'concluida';
}

export class UpdateGoalAction implements ActionHandler {
  readonly kind: ActionKind = 'goal.update';

  constructor(private readonly goalsService: GoalsService = defaultGoalsService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const id = getString(payload, 'id');
    if (!id) {
      return { success: false, message: 'Preciso do "id" da meta para atualizá-la.' };
    }
    const rawStatus = getString(payload, 'status');
    return this.goalsService.updateGoal({
      id,
      progress: getNumber(payload, 'progress'),
      status: rawStatus && isMissionStatus(rawStatus) ? rawStatus : undefined,
      title: getString(payload, 'title'),
      dueDate: getString(payload, 'dueDate'),
    });
  }
}
