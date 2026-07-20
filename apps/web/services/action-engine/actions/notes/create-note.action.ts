import type { NotesService } from '@/services/modules';
import { notesService as defaultNotesService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { ActionHandler } from '../../action.interfaces';
import { getString } from '../../payload-guards';

export class CreateNoteAction implements ActionHandler {
  readonly kind: ActionKind = 'note.create';

  readonly capability: Capability = {
    kind: 'note.create',
    description: 'Cria uma nota de texto livre pedida pelo usuário.',
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Título da nota.' },
      { name: 'content', type: 'string', required: false, description: 'Conteúdo da nota.' },
      { name: 'category', type: 'string', required: false, description: 'Categoria da nota, se mencionada.' },
    ],
    examples: [
      'Anota isso: gravar um vídeo sobre o Action Engine -> {"kind":"note.create","confidence":0.85,"parameters":{"title":"Ideia de conteúdo","content":"Gravar um vídeo sobre o Action Engine."}}',
    ],
  };

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
