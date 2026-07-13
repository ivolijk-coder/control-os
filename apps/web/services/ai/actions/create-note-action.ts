import type { NovaActionResult, NovaContext } from '@/services/nova';
import type { Action } from './types';

const DEFAULT_CATEGORY = 'Geral';

export interface CreateNoteInput {
  title: string;
  content: string;
  category?: string;
}

/**
 * Comando "criar uma nota". Sempre cria uma nota do tipo `'texto'` — notas
 * do tipo `'checklist'` continuam sendo criadas por navegação manual em
 * `/notas`, onde faz sentido montar os itens um a um. Implementação
 * completa, mas ainda sem nenhuma `NovaIntentKind`/tool schema apontando
 * para ela — não é disparável numa conversa hoje (auditoria da Etapa 4.5).
 * Conectá-la é trabalho de uma fase futura, não desta auditoria.
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
