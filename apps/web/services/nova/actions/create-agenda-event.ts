import type { AgendaIntent, NovaActionResult, NovaContext } from '../interfaces';

const NO_TIME_LABEL = 'sem horário definido';

/**
 * "Tenho reunião amanhã às 15h" → Criar agenda → Criar lembrete.
 *
 * Arquitetura only (CONTROL OS 3.0): ainda não há parser de datas relativas
 * ("amanhã", "semana que vem") — o evento é criado com a data de hoje. Isso
 * é resolvido quando um modelo real interpretar a mensagem; a interface
 * pública não muda.
 */
export function createAgendaEvent(ctx: NovaContext, intent: AgendaIntent): NovaActionResult[] {
  const nowIso = new Date().toISOString();

  const event = ctx.actions.addAgendaEvent({
    title: intent.title,
    date: nowIso.slice(0, 10),
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
