import type { ActionResult } from '@/services/action-result.types';
import type { StoreDocumentInput } from './documents.types';

export interface DocumentsService {
  storeDocument(input: StoreDocumentInput): Promise<ActionResult>;
}
