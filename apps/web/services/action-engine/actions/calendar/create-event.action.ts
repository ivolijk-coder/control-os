import type { CalendarService } from '@/services/modules';
import { calendarService as defaultCalendarService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { ActionHandler } from '../../action.interfaces';
import { getString } from '../../payload-guards';

/**
 * `calendar.create` — "Amanhã às 15h reunião com Ricardo" → `calendar.create`
 * → `CalendarService.createEvent()` → resposta, exemplo literal do pedido
 * original.
 */
export class CreateEventAction implements ActionHandler {
  readonly kind: ActionKind = 'calendar.create';

  readonly capability: Capability = {
    kind: 'calendar.create',
    description: 'Cria um novo compromisso na agenda do usuário.',
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Título do compromisso.' },
      { name: 'date', type: 'string', required: false, description: 'Data no formato AAAA-MM-DD, se mencionada.' },
      { name: 'time', type: 'string', required: false, description: 'Horário no formato HH:MM, se mencionado.' },
      { name: 'location', type: 'string', required: false, description: 'Local do compromisso, se mencionado.' },
    ],
    examples: [
      'Amanhã às 15h reunião com Ricardo -> {"kind":"calendar.create","confidence":0.9,"parameters":{"title":"Reunião com Ricardo","time":"15:00"}}',
    ],
  };

  constructor(private readonly calendarService: CalendarService = defaultCalendarService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const title = getString(payload, 'title');
    if (!title) {
      return { success: false, message: 'Não entendi o título do compromisso — preciso de um "title" para criar na agenda.' };
    }
    return this.calendarService.createEvent({
      title,
      date: getString(payload, 'date'),
      time: getString(payload, 'time'),
      location: getString(payload, 'location'),
    });
  }
}
