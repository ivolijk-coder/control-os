import { runIntent } from '@/services/nova';
import type { NovaActionResult, NovaContext, NovaIntent } from '@/services/nova';
import type { Action } from '../actions';

const UNAVAILABLE_LEGACY_INTENTS = new Set<NovaIntent['kind']>([
  'criar_lembrete',
  'criar_agenda',
  'excluir_agenda',
  'criar_objetivo',
  'criar_projeto',
  'registrar_divida',
  'criar_habito',
  'criar_viagem',
  'criar_documento',
  'criar_bem',
  'criar_nota',
]);

/**
 * Executa de fato uma Action contra `useDataStore` (CONTROL OS —
 * Preparação para OpenAI GPT-5.5). Último elo da cadeia Nova →
 * ConversationService → AIProvider → IntentResolver → ActionExecutor →
 * Banco de Dados — a IA nunca chega até aqui diretamente.
 *
 * Quando o `IntentResolver` não encontra uma Action dedicada (intents
 * ainda não cobertos pela lista pedida: `criar_projeto`,
 * `registrar_divida`), cai de volta pro executor legado
 * (`services/nova/executor`), que já cobre esses casos — sem duplicar
 * lógica nem quebrar funcionalidade existente.
 */
export class ActionExecutor {
  async execute(ctx: NovaContext, intent: NovaIntent, action: Action | undefined): Promise<NovaActionResult[]> {
    if (UNAVAILABLE_LEGACY_INTENTS.has(intent.kind)) {
      return [{
        action: { kind: 'registrar_timeline', label: 'Capacidade não disponível' },
        ok: false,
        detail: 'Essa capacidade ainda não possui uma fonte persistente real e não foi executada.',
      }];
    }
    if (action) return await action.execute(ctx);
    return runIntent(ctx, intent);
  }
}
