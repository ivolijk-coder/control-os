import type { CalendarService } from '@/services/modules';
import { calendarService as defaultCalendarService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { ActionHandler } from '../../action.interfaces';
import { getString } from '../../payload-guards';

export class UpdateEventAction implements ActionHandler {
  readonly kind: ActionKind = 'calendar.update';

  readonly capability: Capability = {
    kind: 'calendar.update',
    description: 'Atualiza um compromisso já existente na agenda do usuário.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Identificador do compromisso a atualizar.' },
      { name: 'title', type: 'string', required: false, description: 'Novo título, se estiver mudando.' },
      { name: 'date', type: 'string', required: false, description: 'Nova data (AAAA-MM-DD), se estiver mudando.' },
      { name: 'time', type: 'string', required: false, description: 'Novo horário (HH:MM), se estiver mudando.' },
      { name: 'location', type: 'string', required: false, description: 'Novo local, se estiver mudando.' },
    ],
    examples: [
      'Muda a reunião com Ricardo pra 16h -> {"kind":"calendar.update","confidence":0.8,"parameters":{"id":"agenda_1","time":"16:00"}}',
    ],
  };

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
