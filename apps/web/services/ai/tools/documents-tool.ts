import type { NovaActionResult, NovaContext } from '@/services/nova';
import { CreateDocumentAction, type CreateDocumentInput } from '../actions';

/** Ferramenta de Documentos. Hoje só chama a Action correspondente. */
export class DocumentsTool {
  addDocument(ctx: NovaContext, input: CreateDocumentInput): NovaActionResult[] {
    return new CreateDocumentAction(input).execute(ctx);
  }
}
