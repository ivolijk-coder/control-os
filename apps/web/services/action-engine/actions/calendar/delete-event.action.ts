import type { CalendarService } from '@/services/modules';
import { calendarService as defaultCalendarService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { ActionHandler } from '../../action.interfaces';
import { getString } from '../../payload-guards';

export class DeleteEventAction implements ActionHandler {
  readonly kind: ActionKind = 'calendar.delete';

  readonly capability: Capability = {
    kind: 'calendar.delete',
    description: 'Remove um compromisso da agenda do usuário.',
    parameters: [{ name: 'id', type: 'string', required: true, description: 'Identificador do compromisso a remover.' }],
    examples: ['Cancela a reunião com Ricardo -> {"kind":"calendar.delete","confidence":0.85,"parameters":{"id":"agenda_1"}}'],
  };

  constructor(private readonly calendarService: CalendarService = defaultCalendarService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const id = getString(payload, 'id');
    if (!id) {
      return { success: false, message: 'Preciso do "id" do compromisso para removê-lo.' };
    }
    return this.calendarService.deleteEvent({ id });
  }
}
