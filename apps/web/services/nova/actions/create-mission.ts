import type { Mission, MissionKind, MissionStatus } from '@control-os/types';
import type { GoalIntent, NovaActionResult, NovaContext, ProjectIntent, ReminderIntent } from '../interfaces';

interface MissionBlueprint {
  title: string;
  status: MissionStatus;
  kind: MissionKind;
}

/**
 * Mission continua sendo a unidade central reaproveitada para lembretes,
 * metas e projetos criados por conversa — sem tipo novo duplicado (decisão
 * explícita do CONTROL OS 3.0).
 */
function createMissionFromBlueprint(
  ctx: NovaContext,
  blueprint: MissionBlueprint
): { mission: Mission; results: NovaActionResult[] } {
  const mission = ctx.actions.addMission({
    title: blueprint.title,
    spaceId: ctx.defaultSpaceId,
    status: blueprint.status,
    progress: 0,
    objectivesTotal: 1,
    objectivesDone: 0,
    kind: blueprint.kind,
  });

  const timelineEvent = ctx.actions.addTimelineEvent({
    type: 'missao_criada',
    title: `Missão criada: ${mission.title}`,
    timestamp: new Date().toISOString(),
    spaceId: mission.spaceId,
    actor: 'nova',
  });

  return {
    mission,
    results: [
      { action: { kind: 'criar_missao', label: 'Criar missão' }, ok: true, detail: mission.title },
      { action: { kind: 'registrar_timeline', label: 'Atualizar histórico' }, ok: true, detail: timelineEvent.title },
    ],
  };
}

/** "Lembrar de pagar o DAS" → Criar missão → Criar lembrete → Adicionar calendário. */
export function createReminder(ctx: NovaContext, intent: ReminderIntent): NovaActionResult[] {
  const { results } = createMissionFromBlueprint(ctx, { title: intent.title, status: 'planejamento', kind: 'lembrete' });
  return results;
}

/** "Quero faturar R$ 500 mil" / "Quero economizar R$ 500" → Criar objetivo → Criar indicadores → Criar plano. */
export function createGoal(ctx: NovaContext, intent: GoalIntent): NovaActionResult[] {
  const { results } = createMissionFromBlueprint(ctx, { title: intent.title, status: 'planejamento', kind: 'meta' });
  return results;
}

/** "Vou viajar em novembro" → Criar projeto → Checklist → Orçamento → Lembretes. */
export function createProject(ctx: NovaContext, intent: ProjectIntent): NovaActionResult[] {
  const { results } = createMissionFromBlueprint(ctx, { title: intent.title, status: 'planejamento', kind: 'projeto' });
  return results;
}
