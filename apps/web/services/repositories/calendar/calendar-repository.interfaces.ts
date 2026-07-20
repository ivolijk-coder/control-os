import type { AgendaEvent } from '@control-os/types';

/**
 * `CalendarRepository` — CONTROL OS Fase 6. STUB: só a interface existe
 * nesta fase ("os demais podem permanecer com stubs") — nenhuma
 * implementação (`Prisma`/`InMemory`) ainda. `CalendarService`
 * (`services/modules/calendar`) continua sobre `MockCalendarService` até
 * este repositório ganhar uma implementação real, mesmo padrão que
 * `FinanceRepository` seguiu quando só a interface existia (Fase 4).
 *
 * Forma espelha `FinanceRepository` (`create`/`update`/`delete`/`list`,
 * escopado por `userId`) — "o mesmo padrão de persistência reutilizado por
 * Agenda... e todos os módulos futuros".
 */
export interface CreateAgendaEventInput {
  title: string;
  date?: string;
  time?: string;
  location?: string;
}

export interface UpdateAgendaEventInput {
  id: string;
  title?: string;
  date?: string;
  time?: string;
  location?: string;
}

export interface CalendarRepository {
  create(userId: string, input: CreateAgendaEventInput): Promise<AgendaEvent>;
  update(userId: string, input: UpdateAgendaEventInput): Promise<AgendaEvent | undefined>;
  delete(userId: string, id: string): Promise<AgendaEvent | undefined>;
  list(userId: string): Promise<AgendaEvent[]>;
}
