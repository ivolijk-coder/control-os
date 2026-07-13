import type { NovaActionResult, NovaContext } from '@/services/nova';
import { CreateAppointmentAction, type CreateAppointmentInput } from '../actions';

/**
 * Ferramenta de Agenda (CONTROL OS — Preparação para OpenAI GPT-5.5). Hoje
 * só chama a Action correspondente — é o "verbo" que um provedor de IA real
 * vai invocar (ex.: via function calling) sem precisar conhecer como a
 * gravação em `useDataStore` funciona por baixo.
 */
export class CalendarTool {
  createAppointment(ctx: NovaContext, input: CreateAppointmentInput): NovaActionResult[] {
    return new CreateAppointmentAction(input).execute(ctx);
  }
}
