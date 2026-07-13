import type { NovaActionResult, NovaContext } from '@/services/nova';
import { CreateNoteAction, type CreateNoteInput } from '../actions';

/** Ferramenta de Notas. Hoje só chama a Action correspondente. */
export class NotesTool {
  createNote(ctx: NovaContext, input: CreateNoteInput): NovaActionResult[] {
    return new CreateNoteAction(input).execute(ctx);
  }
}
