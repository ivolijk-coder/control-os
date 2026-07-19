import type { AgendaIntent, NovaActionResult, NovaContext } from '../interfaces';

const NO_TIME_LABEL = 'sem horário definido';

/**
 * "Tenho reunião amanhã às 15h" → Criar agenda → Criar lembrete.
 *
 * CONTROL OS — Etapa 14 (Execution Engine): agora que o modelo real
 * (OpenAI) recebe a data de hoje no contexto (`buildModelContextSummary`) e
 * resolve datas relativas ("amanhã", "sexta", "semana que vem") antes de
 * chamar a Tool, `intent.date` já chega pronta em ISO — este é o único
 * lugar que decide o fallback: sem `date` nenhuma (usuário não mencionou
 * nenhuma referência de tempo), o compromisso continua caindo em hoje,
 * exatamente como antes desta etapa.
 */
export function createAgendaEvent(ctx: NovaContext, intent: AgendaIntent): NovaActionResult[] {
  const nowIso = new Date().toISOString();

  const event = ctx.actions.addAgendaEvent({
    title: intent.title,
    date: intent.date ?? nowIso.slice(0, 10),
    time: intent.time,
    spaceId: ctx.defaultSpaceId,
  });

  const mission = ctx.actions.addMission({
    title: `Lembrete: ${event.title}`,
    spaceId: ctx.defaultSpaceId,
    status: 'planejamento',
    progress: 0,
    objectivesTotal: 1,
    objectivesDone: 0,
  });

  const timelineEvent = ctx.actions.addTimelineEvent({
    type: 'agenda_criada',
    title: `Compromisso criado: ${event.title}`,
    description: event.time ? `Às ${event.time}` : NO_TIME_LABEL,
    timestamp: nowIso,
    spaceId: event.spaceId,
    actor: 'nova',
  });

  return [
    { action: { kind: 'criar_evento_agenda', label: 'Criar compromisso na agenda' }, ok: true, detail: event.title },
    { action: { kind: 'criar_missao', label: 'Criar lembrete vinculado' }, ok: true, detail: mission.title },
    { action: { kind: 'registrar_timeline', label: 'Atualizar histórico' }, ok: true, detail: timelineEvent.title },
  ];
}
