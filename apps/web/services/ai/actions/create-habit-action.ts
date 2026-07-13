import type { NovaActionResult, NovaContext } from '@/services/nova';
import type { Action } from './types';

const DEFAULT_CATEGORY = 'Geral';

export interface CreateHabitInput {
  title: string;
  category?: string;
}

/**
 * Comando "criar um hábito". Implementação completa e correta, mas ainda
 * sem nenhuma `NovaIntentKind`/tool schema apontando para ela — nem
 * `MockAIProvider` nem `OpenAIProvider` conseguem disparar esta Action
 * numa conversa hoje (auditoria da Etapa 4.5). Conectá-la é trabalho de uma
 * fase futura (nova intent + schema em `services/ai/tools/schemas.ts` +
 * caso no `IntentResolver`), não desta auditoria.
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
