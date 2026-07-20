import type { ActionResult } from '@/services/action-result.types';
import type { CreateEventInput, DeleteEventInput, UpdateEventInput } from './calendar.types';

/** Contrato do módulo Agenda. As Actions de `calendar.*` dependem só disto. */
export interface CalendarService {
  createEvent(input: CreateEventInput): Promise<ActionResult>;
  updateEvent(input: UpdateEventInput): Promise<ActionResult>;
  deleteEvent(input: DeleteEventInput): Promise<ActionResult>;
}
