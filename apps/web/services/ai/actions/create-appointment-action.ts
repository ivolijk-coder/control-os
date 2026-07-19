import { createAgendaEvent } from '@/services/nova';
import type { NovaActionResult, NovaContext } from '@/services/nova';
import type { Action } from './types';

export interface CreateAppointmentInput {
  title: string;
  time?: string;
  /** Ver `AgendaIntent.date` — data em ISO (`YYYY-MM-DD`), quando mencionada. */
  date?: string;
}

/**
 * Comando "criar um compromisso na agenda" — resolvido pelo `IntentResolver`
 * a partir da intent `criar_agenda`. Reaproveita `createAgendaEvent`
 * (`services/nova/actions/create-agenda-event.ts`), que também cria o
 * lembrete vinculado em Missões.
 */
export class CreateAppointmentAction implements Action {
  constructor(private readonly input: CreateAppointmentInput) {}

  execute(ctx: NovaContext): NovaActionResult[] {
    return createAgendaEvent(ctx, {
      kind: 'criar_agenda',
      raw: this.input.title,
      title: this.input.title,
      time: this.input.time,
      date: this.input.date,
    });
  }
}
