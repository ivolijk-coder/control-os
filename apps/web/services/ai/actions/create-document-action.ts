import type { NovaActionResult, NovaContext } from '@/services/nova';
import type { Action } from './types';

const DEFAULT_CATEGORY = 'Geral';

export interface CreateDocumentInput {
  title: string;
  category?: string;
  expiresAt?: string;
}

/**
 * Comando "adicionar um documento" — usado pelo `DocumentsTool`. Sem função
 * equivalente em `services/nova/actions` ainda; implementação nova.
 */
export class CreateDocumentAction implements Action {
  constructor(private readonly input: CreateDocumentInput) {}

  execute(ctx: NovaContext): NovaActionResult[] {
    const document = ctx.actions.addDocument({
      title: this.input.title,
      category: this.input.category ?? DEFAULT_CATEGORY,
      addedAt: new Date().toISOString(),
      expiresAt: this.input.expiresAt,
      spaceId: ctx.defaultSpaceId,
    });

    const timelineEvent = ctx.actions.addTimelineEvent({
      type: 'documento',
      title: `Documento adicionado: ${document.title}`,
      timestamp: document.addedAt,
      spaceId: document.spaceId,
      actor: 'nova',
    });

    return [
      { action: { kind: 'criar_documento', label: 'Adicionar documento' }, ok: true, detail: document.title },
      { action: { kind: 'registrar_timeline', label: 'Atualizar histórico' }, ok: true, detail: timelineEvent.title },
    ];
  }
}
