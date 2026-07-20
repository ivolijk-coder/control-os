import type { PersonalDocument } from '@control-os/types';

/** `DocumentRepository` — CONTROL OS Fase 6. STUB (ver doc de `CalendarRepository`). Só `store`/`list` — mesmo catálogo de ações atual (`document.store`). */
export interface StoreDocumentRecordInput {
  title: string;
  category?: string;
  expiresAt?: string;
}

export interface DocumentRepository {
  store(userId: string, input: StoreDocumentRecordInput): Promise<PersonalDocument>;
  list(userId: string): Promise<PersonalDocument[]>;
}
