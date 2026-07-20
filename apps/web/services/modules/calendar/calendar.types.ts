/** Mesmos campos de `AgendaEvent` (`@control-os/types`), sem `id` (gerado pelo Service). */
export interface CreateEventInput {
  title: string;
  date?: string;
  time?: string;
  location?: string;
}

export interface UpdateEventInput {
  id: string;
  title?: string;
  date?: string;
  time?: string;
  location?: string;
}

export interface DeleteEventInput {
  id: string;
}
