import type { NovaActionResult, NovaContext } from '@/services/nova';
import type { Action } from './types';

const DEFAULT_CATEGORY = 'Geral';

export interface CreateAssetInput {
  name: string;
  estimatedValue: number;
  category?: string;
}

/**
 * Comando "registrar um bem patrimonial". Implementação completa, mas
 * ainda sem nenhuma `NovaIntentKind`/tool schema apontando para ela — não é
 * disparável numa conversa hoje (auditoria da Etapa 4.5). Conectá-la é
 * trabalho de uma fase futura, não desta auditoria.
 */
export class CreateAssetAction implements Action {
  constructor(private readonly input: CreateAssetInput) {}

  execute(ctx: NovaContext): NovaActionResult[] {
    const asset = ctx.actions.addAsset({
      name: this.input.name,
      category: this.input.category ?? DEFAULT_CATEGORY,
      estimatedValue: this.input.estimatedValue,
      spaceId: ctx.defaultSpaceId,
    });

    const timelineEvent = ctx.actions.addTimelineEvent({
      type: 'sistema',
      title: `Bem registrado: ${asset.name}`,
      description: `R$ ${asset.estimatedValue.toFixed(2)}`,
      timestamp: new Date().toISOString(),
      spaceId: asset.spaceId,
      actor: 'nova',
    });

    return [
      { action: { kind: 'criar_bem', label: 'Registrar bem patrimonial' }, ok: true, detail: asset.name },
      { action: { kind: 'registrar_timeline', label: 'Atualizar histórico' }, ok: true, detail: timelineEvent.title },
    ];
  }
}
