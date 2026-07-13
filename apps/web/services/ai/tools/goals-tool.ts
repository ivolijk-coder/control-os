import type { NovaActionResult, NovaContext } from '@/services/nova';
import { CreateGoalAction, CreateReminderAction, type CreateGoalInput, type CreateReminderInput } from '../actions';

/**
 * Ferramenta de Metas — inclui lembretes porque, no CONTROL OS, os dois
 * reaproveitam a mesma unidade central (Missão), só com `kind` diferente.
 * Hoje só chama as Actions correspondentes.
 */
export class GoalsTool {
  createGoal(ctx: NovaContext, input: CreateGoalInput): NovaActionResult[] {
    return new CreateGoalAction(input).execute(ctx);
  }

  createReminder(ctx: NovaContext, input: CreateReminderInput): NovaActionResult[] {
    return new CreateReminderAction(input).execute(ctx);
  }
}
