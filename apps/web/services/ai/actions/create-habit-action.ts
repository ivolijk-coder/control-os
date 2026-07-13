import type { NovaActionResult, NovaContext } from '@/services/nova';
import type { Action } from './types';

const DEFAULT_CATEGORY = 'Geral';

export interface CreateHabitInput {
  title: string;
  category?: string;
}

/**
 * Comando "criar um hábito" — usado pelo `HabitsTool`. Sem função
 * equivalente em `services/nova/actions` ainda (o parser determinístico não
 * detecta esse tipo de intenção hoje) — implementação nova, seguindo o
 * mesmo padrão das Actions existentes (grava o registro + evento na
 * Timeline).
 */
export class CreateHabitAction implements Action {
  constructor(private readonly input: CreateHabitInput) {}

  execute(ctx: NovaContext): NovaActionResult[] {
    const habit = ctx.actions.addHabit({
      title: this.input.title,
      category: this.input.category ?? DEFAULT_CATEGORY,
      streakDays: 0,
      completedToday: false,
      last7Days: [false, false, false, false, false, false, false],
      spaceId: ctx.defaultSpaceId,
    });

    const timelineEvent = ctx.actions.addTimelineEvent({
      type: 'sistema',
      title: `Hábito criado: ${habit.title}`,
      timestamp: new Date().toISOString(),
      spaceId: habit.spaceId,
      actor: 'nova',
    });

    return [
      { action: { kind: 'criar_habito', label: 'Criar hábito' }, ok: true, detail: habit.title },
      { action: { kind: 'registrar_timeline', label: 'Atualizar histórico' }, ok: true, detail: timelineEvent.title },
    ];
  }
}
