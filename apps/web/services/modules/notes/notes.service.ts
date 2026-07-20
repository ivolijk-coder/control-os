import type { Note } from '@control-os/types';
import type { ActionResult } from '@/services/action-result.types';
import type { NotesService } from './notes.interfaces';
import type { CreateNoteInput } from './notes.types';

const DEFAULT_CATEGORY = 'Geral';
let nextId = 1;

/** Mock em memória — mesmo princípio de `MockFinanceService`, ver aquele arquivo para a justificativa completa. */
export class MockNotesService implements NotesService {
  private readonly notes: Note[] = [
    { id: 'note_seed_1', title: 'Ideias para o próximo lançamento', type: 'texto', category: 'Trabalho', createdAt: new Date().toISOString(), content: 'Rascunho inicial.' },
  ];

  async createNote(input: CreateNoteInput): Promise<ActionResult> {
    const note: Note = {
      id: `note_${nextId++}`,
      title: input.title,
      type: 'texto',
      category: input.category ?? DEFAULT_CATEGORY,
      createdAt: new Date().toISOString(),
      content: input.content,
    };
    this.notes.push(note);
    return { success: true, message: `Nota "${note.title}" criada.`, data: note };
  }
}

export const notesService: NotesService = new MockNotesService();
