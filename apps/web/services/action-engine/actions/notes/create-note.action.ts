import type { NotesService } from '@/services/modules';
import { notesService as defaultNotesService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { ActionHandler } from '../../action.interfaces';
import { getString } from '../../payload-guards';

export class CreateNoteAction implements ActionHandler {
  readonly kind: ActionKind = 'note.create';

  constructor(private readonly notesService: NotesService = defaultNotesService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const title = getString(payload, 'title');
    if (!title) {
      return { success: false, message: 'Não entendi o título da nota — preciso de um "title" para criar.' };
    }
    return this.notesService.createNote({
      title,
      content: getString(payload, 'content'),
      category: getString(payload, 'category'),
    });
  }
}
