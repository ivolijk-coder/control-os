import type { Note } from '@control-os/types';

/** `NotesRepository` — CONTROL OS Fase 6. STUB (ver doc de `CalendarRepository`). Só `create`/`list` — mesmo catálogo de ações atual (`note.create`). */
export interface CreateNoteRecordInput {
  title: string;
  content?: string;
  category?: string;
}

export interface NotesRepository {
  create(userId: string, input: CreateNoteRecordInput): Promise<Note>;
  list(userId: string): Promise<Note[]>;
}
