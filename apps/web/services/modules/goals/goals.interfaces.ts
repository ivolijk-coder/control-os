import type { ActionResult } from '@/services/action-result.types';
import type { CreateMissionInput, UpdateGoalInput } from './goals.types';

/**
 * Contrato do módulo Metas/Missões. `createMission` é usado pela Action de
 * `task.create` (cria com `kind: 'lembrete'` por padrão); `updateGoal` é
 * usado pela Action de `goal.update`.
 */
export interface GoalsService {
  createMission(input: CreateMissionInput): Promise<ActionResult>;
  updateGoal(input: UpdateGoalInput): Promise<ActionResult>;
}
