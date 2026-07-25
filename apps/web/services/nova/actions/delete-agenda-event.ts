import type { DeleteAgendaIntent, NovaActionResult, NovaContext } from '../interfaces';

/**
 * Remove somente o compromisso cujo ID foi escolhido a partir do contexto
 * real da agenda. A confirmação é tratada antes da execução por
 * `ConversationService`, então esta função nunca apaga por impulso.
 */
export function deleteAgendaEvent(ctx: NovaContext, intent: DeleteAgendaIntent): NovaActionResult[] {
  const event = ctx.agendaEvents.find((item) => item.id === intent.eventId);

  if (!event) {
    return [
      {
        action: { kind: 'excluir_evento_agenda', label: 'Excluir compromisso da agenda' },
        ok: false,
        detail: 'Não encontrei esse compromisso na agenda.',
      },
    ];
  }

  ctx.actions.deleteAgendaEvent(event.id);
  return [
    {
      action: { kind: 'excluir_evento_agenda', label: 'Excluir compromisso da agenda' },
      ok: true,
      detail: event.title,
    },
  ];
}
