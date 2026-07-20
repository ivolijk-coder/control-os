import type { DocumentsService } from '@/services/modules';
import { documentsService as defaultDocumentsService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { ActionHandler } from '../../action.interfaces';
import { getString } from '../../payload-guards';

export class StoreDocumentAction implements ActionHandler {
  readonly kind: ActionKind = 'document.store';

  readonly capability: Capability = {
    kind: 'document.store',
    description: 'Guarda um documento pessoal do usuário (ex.: RG, passaporte, contrato).',
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Nome do documento.' },
      { name: 'category', type: 'string', required: false, description: 'Categoria do documento (ex.: Identidade, Contrato).' },
      { name: 'expiresAt', type: 'string', required: false, description: 'Data de validade (AAAA-MM-DD), se mencionada.' },
    ],
    examples: [
      'Guarda meu passaporte, vence em dezembro de 2027 -> {"kind":"document.store","confidence":0.8,"parameters":{"title":"Passaporte","expiresAt":"2027-12-31"}}',
    ],
  };

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
