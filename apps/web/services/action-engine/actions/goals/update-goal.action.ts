import type { MissionStatus } from '@control-os/types';
import type { GoalsService } from '@/services/modules';
import { goalsService as defaultGoalsService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { ActionHandler } from '../../action.interfaces';
import { getNumber, getString } from '../../payload-guards';

/** Narrowing específico de domínio (não genérico o bastante pra `payload-guards.ts`) — mesmo padrão de `isNovaFactCategory` em `services/nova/memory`. */
function isMissionStatus(value: string): value is MissionStatus {
  return value === 'planejamento' || value === 'em_andamento' || value === 'em_risco' || value === 'concluida';
}

export class UpdateGoalAction implements ActionHandler {
  readonly kind: ActionKind = 'goal.update';

  readonly capability: Capability = {
    kind: 'goal.update',
    description: 'Atualiza o progresso ou status de uma meta/objetivo já existente do usuário.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Identificador da meta a atualizar.' },
      { name: 'progress', type: 'number', required: false, description: 'Novo progresso (0–100), se mencionado.' },
      {
        name: 'status',
        type: 'string',
        required: false,
        description: 'Novo status: "planejamento", "em_andamento", "em_risco" ou "concluida".',
      },
      { name: 'title', type: 'string', required: false, description: 'Novo título, se estiver mudando.' },
      { name: 'dueDate', type: 'string', required: false, description: 'Novo prazo (AAAA-MM-DD), se estiver mudando.' },
    ],
    examples: [
      'Terminei a meta de correr 5km -> {"kind":"goal.update","confidence":0.82,"parameters":{"id":"goal_1","status":"concluida"}}',
    ],
  };

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
