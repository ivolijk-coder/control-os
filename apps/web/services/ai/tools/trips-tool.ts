import type { NovaActionResult, NovaContext } from '@/services/nova';
import { CreateTripAction, type CreateTripInput } from '../actions';

/** Ferramenta de Viagens. Hoje só chama a Action correspondente. */
export class TripsTool {
  createTrip(ctx: NovaContext, input: CreateTripInput): NovaActionResult[] {
    return new CreateTripAction(input).execute(ctx);
  }
}
