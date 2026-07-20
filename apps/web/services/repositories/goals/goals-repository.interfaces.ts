import type { Mission, MissionKind, MissionStatus } from '@control-os/types';

/**
 * `GoalsRepository` — CONTROL OS Fase 6. STUB (ver doc de
 * `CalendarRepository` para o raciocínio completo, idêntico aqui). Cobre
 * `Mission` (`@control-os/types`) — mesma entidade unificada que já serve
 * tarefa/lembrete, meta e projeto via `MissionKind` (ver
 * `services/modules/goals/goals.types.ts`), não um tipo `Goal` à parte.
 */
export interface CreateMissionInput {
  title: string;
  kind?: MissionKind;
  dueDate?: string;
}

export interface UpdateMissionInput {
  id: string;
  progress?: number;
  status?: MissionStatus;
  title?: string;
  dueDate?: string;
}

export interface GoalsRepository {
  create(userId: string, input: CreateMissionInput): Promise<Mission>;
  update(userId: string, input: UpdateMissionInput): Promise<Mission | undefined>;
  delete(userId: string, id: string): Promise<Mission | undefined>;
  list(userId: string): Promise<Mission[]>;
}
