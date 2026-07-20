import type { AgendaEvent } from '@control-os/types';
import type { ActionResult } from '@/services/action-result.types';
import type { CalendarService } from './calendar.interfaces';
import type { CreateEventInput, DeleteEventInput, UpdateEventInput } from './calendar.types';

let nextId = 1;

function toLocalDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Mock em memória — mesmo princípio de `MockFinanceService`, ver aquele arquivo para a justificativa completa. */
export class MockCalendarService implements CalendarService {
  private readonly events: AgendaEvent[] = [
    { id: 'agenda_seed_1', title: 'Reunião de alinhamento semanal', date: toLocalDateString(new Date()), time: '10:00' },
  ];

  async createEvent(input: CreateEventInput): Promise<ActionResult> {
    const event: AgendaEvent = {
      id: `agenda_${nextId++}`,
      title: input.title,
      date: input.date ?? toLocalDateString(new Date()),
      time: input.time,
      location: input.location,
    };
    this.events.push(event);
    return {
      success: true,
      message: `Compromisso "${event.title}" adicionado à agenda${event.date ? ` para ${event.date}` : ''}${event.time ? ` às ${event.time}` : ''}.`,
      data: event,
    };
  }

  async updateEvent(input: UpdateEventInput): Promise<ActionResult> {
    const event = this.events.find((candidate) => candidate.id === input.id);
    if (!event) {
      return { success: false, message: `Nenhum compromisso encontrado com o id "${input.id}".` };
    }
    if (input.title !== undefined) event.title = input.title;
    if (input.date !== undefined) event.date = input.date;
    if (input.time !== undefined) event.time = input.time;
    if (input.location !== undefined) event.location = input.location;
    return { success: true, message: `Compromisso "${event.title}" atualizado.`, data: event };
  }

  async deleteEvent(input: DeleteEventInput): Promise<ActionResult> {
    const index = this.events.findIndex((candidate) => candidate.id === input.id);
    if (index === -1) {
      return { success: false, message: `Nenhum compromisso encontrado com o id "${input.id}".` };
    }
    const [removed] = this.events.splice(index, 1);
    return { success: true, message: `Compromisso "${removed?.title ?? input.id}" removido da agenda.`, data: removed };
  }
}

export const calendarService: CalendarService = new MockCalendarService();
