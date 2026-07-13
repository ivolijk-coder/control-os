import { runIntent } from '@/services/nova';
import type { NovaActionResult, NovaContext, NovaIntent } from '@/services/nova';
import type { Action } from '../actions';

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
  execute(ctx: NovaContext, intent: NovaIntent, action: Action | undefined): NovaActionResult[] {
    if (action) return action.execute(ctx);
    return runIntent(ctx, intent);
  }
}
