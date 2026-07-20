import type { ActionResult } from '@/services/action-result.types';
import type { CreateNoteInput } from './notes.types';

export interface NotesService {
  createNote(input: CreateNoteInput): Promise<ActionResult>;
}
