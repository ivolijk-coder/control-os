import { createGoal, createReminder } from '@/services/nova';
import type { NovaActionResult, NovaContext } from '@/services/nova';
import type { Action } from './types';

export interface CreateReminderInput {
  title: string;
  /** Ver `ReminderIntent.dueDate` — prazo em ISO (`YYYY-MM-DD`), quando mencionado. */
  dueDate?: string;
  /** Ver `ReminderIntent.time` — horário `HH:MM`, quando mencionado. */
  time?: string;
}

export interface CreateGoalInput {
  title: string;
  /** Prazo em ISO (`YYYY-MM-DD`), quando mencionado. Ver `GoalIntent.dueDate`. */
  dueDate?: string;
}

/**
 * Comando "criar um lembrete" — resolvido pelo `IntentResolver` a partir da
 * intent `criar_lembrete`. Reaproveita `createReminder`
 * (`services/nova/actions/create-mission.ts`) — Missão continua sendo a
 * unidade central, sem tipo duplicado.
 */
export class CreateReminderAction implements Action {
  constructor(private readonly input: CreateReminderInput) {}

  execute(ctx: NovaContext): NovaActionResult[] {
    return createReminder(ctx, {
      kind: 'criar_lembrete',
      raw: this.input.title,
      title: this.input.title,
      dueDate: this.input.dueDate,
      time: this.input.time,
    });
  }
}

/**
 * Comando "criar uma meta" — resolvido pelo `IntentResolver` a partir da
 * intent `criar_objetivo`. Reaproveita `createGoal`
 * (`services/nova/actions/create-mission.ts`).
 */
export class CreateGoalAction implements Action {
  constructor(private readonly input: CreateGoalInput) {}

  execute(ctx: NovaContext): NovaActionResult[] {
    return createGoal(ctx, {
      kind: 'criar_objetivo',
      raw: this.input.title,
      title: this.input.title,
      dueDate: this.input.dueDate,
    });
  }
}
