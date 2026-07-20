import type { CalendarService } from '@/services/modules';
import { calendarService as defaultCalendarService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { ActionHandler } from '../../action.interfaces';
import { getString } from '../../payload-guards';

export class UpdateEventAction implements ActionHandler {
  readonly kind: ActionKind = 'calendar.update';

  constructor(private readonly calendarService: CalendarService = defaultCalendarService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const id = getString(payload, 'id');
    if (!id) {
      return { success: false, message: 'Preciso do "id" do compromisso para atualizá-lo.' };
    }
    return this.calendarService.updateEvent({
      id,
      title: getString(payload, 'title'),
      date: getString(payload, 'date'),
      time: getString(payload, 'time'),
      location: getString(payload, 'location'),
    });
  }
}
