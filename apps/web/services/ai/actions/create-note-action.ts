import type { NovaActionResult, NovaContext } from '@/services/nova';
import type { Action } from './types';

const DEFAULT_CATEGORY = 'Geral';

export interface CreateNoteInput {
  title: string;
  content: string;
  category?: string;
}

/**
 * Comando "criar uma nota" — usado pelo `NotesTool`. Sem função equivalente
 * em `services/nova/actions` ainda; implementação nova. Sempre cria uma
 * nota do tipo `'texto'` — notas do tipo `'checklist'` continuam sendo
 * criadas por navegação manual em `/notas`, onde faz sentido montar os
 * itens um a um.
 */
export class CreateNoteAction implements Action {
  constructor(private readonly input: CreateNoteInput) {}

  execute(ctx: NovaContext): NovaActionResult[] {
    const note = ctx.actions.addNote({
      title: this.input.title,
      type: 'texto',
      category: this.input.category ?? DEFAULT_CATEGORY,
      createdAt: new Date().toISOString(),
      content: this.input.content,
      spaceId: ctx.defaultSpaceId,
    });

    const timelineEvent = ctx.actions.addTimelineEvent({
      type: 'sistema',
      title: `Nota criada: ${note.title}`,
      timestamp: note.createdAt,
      spaceId: note.spaceId,
      actor: 'nova',
    });

    return [
      { action: { kind: 'criar_nota', label: 'Criar nota' }, ok: true, detail: note.title },
      { action: { kind: 'registrar_timeline', label: 'Atualizar histórico' }, ok: true, detail: timelineEvent.title },
    ];
  }
}
