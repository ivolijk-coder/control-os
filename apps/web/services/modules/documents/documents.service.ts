import type { PersonalDocument } from '@control-os/types';
import type { ActionResult } from '@/services/action-result.types';
import type { DocumentsService } from './documents.interfaces';
import type { StoreDocumentInput } from './documents.types';

const DEFAULT_CATEGORY = 'Geral';
let nextId = 1;

/**
 * Mock em memória — mesmo princípio de `MockFinanceService`, ver aquele
 * arquivo para a justificativa completa. "document.store", não
 * "document.create": nesta fase guarda só METADADOS (`PersonalDocument`),
 * nunca o arquivo em si — upload/armazenamento de binário fica para uma
 * fase futura (fora do escopo: "não implementar... OCR").
 */
export class MockDocumentsService implements DocumentsService {
  private readonly documents: PersonalDocument[] = [
    { id: 'document_seed_1', title: 'Contrato de prestação de serviço', category: 'Contratos', addedAt: new Date().toISOString() },
  ];

  async storeDocument(input: StoreDocumentInput): Promise<ActionResult> {
    const document: PersonalDocument = {
      id: `document_${nextId++}`,
      title: input.title,
      category: input.category ?? DEFAULT_CATEGORY,
      addedAt: new Date().toISOString(),
      expiresAt: input.expiresAt,
    };
    this.documents.push(document);
    return { success: true, message: `Documento "${document.title}" guardado.`, data: document };
  }
}

export const documentsService: DocumentsService = new MockDocumentsService();
