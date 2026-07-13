import type { NovaActionResult, NovaContext } from '@/services/nova';
import type { Action } from './types';

export interface CreateTripInput {
  destination: string;
  startDate: string;
  endDate: string;
  budget?: number;
}

/**
 * Comando "criar uma viagem" — usado pelo `TripsTool`. Sem função
 * equivalente em `services/nova/actions` ainda; implementação nova, mesmo
 * padrão das demais (checklist começa vazio — item por item vem depois, por
 * navegação manual em `/viagens`).
 */
export class CreateTripAction implements Action {
  constructor(private readonly input: CreateTripInput) {}

  execute(ctx: NovaContext): NovaActionResult[] {
    const trip = ctx.actions.addTrip({
      destination: this.input.destination,
      startDate: this.input.startDate,
      endDate: this.input.endDate,
      budget: this.input.budget,
      checklist: [],
      spaceId: ctx.defaultSpaceId,
    });

    const timelineEvent = ctx.actions.addTimelineEvent({
      type: 'sistema',
      title: `Viagem criada: ${trip.destination}`,
      timestamp: new Date().toISOString(),
      spaceId: trip.spaceId,
      actor: 'nova',
    });

    return [
      { action: { kind: 'criar_viagem', label: 'Criar viagem' }, ok: true, detail: trip.destination },
      { action: { kind: 'registrar_timeline', label: 'Atualizar histórico' }, ok: true, detail: timelineEvent.title },
    ];
  }
}
