import type { MissionKind, MissionStatus } from '@control-os/types';

/**
 * `task.create` e `goal.update` (catálogo de ações do pedido original)
 * operam sobre o MESMO conceito de domínio — `Mission` (`@control-os/types`,
 * já usada hoje pra tarefa/lembrete, meta e projeto via `MissionKind`). Por
 * isso um único `GoalsService` cobre os dois, em vez de um `TasksService` +
 * `GoalsService` guardando duas cópias da mesma entidade — mesma
 * justificativa que o próprio modelo de dados já usa (`MissionKind` unifica
 * lembrete/meta/projeto num tipo só, não três).
 */
export interface CreateMissionInput {
  title: string;
  kind?: MissionKind;
  dueDate?: string;
}

export interface UpdateGoalInput {
  id: string;
  progress?: number;
  status?: MissionStatus;
  title?: string;
  dueDate?: string;
}
