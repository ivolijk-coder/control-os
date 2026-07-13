import type { NovaActionResult, NovaContext } from '@/services/nova';
import { CreateHabitAction, type CreateHabitInput } from '../actions';

/** Ferramenta de Hábitos. Hoje só chama a Action correspondente. */
export class HabitsTool {
  createHabit(ctx: NovaContext, input: CreateHabitInput): NovaActionResult[] {
    return new CreateHabitAction(input).execute(ctx);
  }
}
