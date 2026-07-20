import type { Mission } from '@control-os/types';
import type { ActionResult } from '@/services/action-result.types';
import type { GoalsService } from './goals.interfaces';
import type { CreateMissionInput, UpdateGoalInput } from './goals.types';

const DEFAULT_SPACE_ID = 'sp_vida';
let nextId = 1;

/** Mock em memória — mesmo princípio de `MockFinanceService`, ver aquele arquivo para a justificativa completa. */
export class MockGoalsService implements GoalsService {
  private readonly missions: Mission[] = [
    { id: 'goal_seed_1', title: 'Organizar a semana', spaceId: DEFAULT_SPACE_ID, status: 'em_andamento', progress: 40, objectivesTotal: 5, objectivesDone: 2, kind: 'meta' },
  ];

  async createMission(input: CreateMissionInput): Promise<ActionResult> {
    const mission: Mission = {
      id: `goal_${nextId++}`,
      title: input.title,
      spaceId: DEFAULT_SPACE_ID,
      status: 'planejamento',
      progress: 0,
      dueDate: input.dueDate,
      objectivesTotal: 1,
      objectivesDone: 0,
      kind: input.kind ?? 'lembrete',
    };
    this.missions.push(mission);
    return { success: true, message: `"${mission.title}" criado em Missões.`, data: mission };
  }

  async updateGoal(input: UpdateGoalInput): Promise<ActionResult> {
    const mission = this.missions.find((candidate) => candidate.id === input.id);
    if (!mission) {
      return { success: false, message: `Nenhuma missão encontrada com o id "${input.id}".` };
    }
    if (input.progress !== undefined) mission.progress = input.progress;
    if (input.status !== undefined) mission.status = input.status;
    if (input.title !== undefined) mission.title = input.title;
    if (input.dueDate !== undefined) mission.dueDate = input.dueDate;
    return { success: true, message: `"${mission.title}" atualizado (${mission.progress}%).`, data: mission };
  }
}

export const goalsService: GoalsService = new MockGoalsService();
