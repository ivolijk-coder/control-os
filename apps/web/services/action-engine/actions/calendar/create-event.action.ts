import type { CalendarService } from '@/services/modules';
import { calendarService as defaultCalendarService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { ActionHandler } from '../../action.interfaces';
import { getString } from '../../payload-guards';

/**
 * `calendar.create` — "Amanhã às 15h reunião com Ricardo" → `calendar.create`
 * → `CalendarService.createEvent()` → resposta, exemplo literal do pedido
 * original.
 */
export class CreateEventAction implements ActionHandler {
  readonly kind: ActionKind = 'calendar.create';

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
