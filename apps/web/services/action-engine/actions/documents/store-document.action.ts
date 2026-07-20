import type { DocumentsService } from '@/services/modules';
import { documentsService as defaultDocumentsService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { ActionHandler } from '../../action.interfaces';
import { getString } from '../../payload-guards';

export class StoreDocumentAction implements ActionHandler {
  readonly kind: ActionKind = 'document.store';

  constructor(private readonly documentsService: DocumentsService = defaultDocumentsService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const title = getString(payload, 'title');
    if (!title) {
      return { success: false, message: 'Não entendi o título do documento — preciso de um "title" para guardar.' };
    }
    return this.documentsService.storeDocument({
      title,
      category: getString(payload, 'category'),
      expiresAt: getString(payload, 'expiresAt'),
    });
  }
}
