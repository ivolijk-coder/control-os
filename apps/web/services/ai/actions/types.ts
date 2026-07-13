import type { NovaActionResult, NovaContext } from '@/services/nova';

/**
 * Contrato comum de toda Action da camada de IA (CONTROL OS — Preparação
 * para OpenAI GPT-5.5). "A IA nunca modifica diretamente os dados. Ela
 * apenas identifica a intenção. Quem executa alterações são as Actions." —
 * por isso toda Action recebe o `NovaContext` (que carrega `ctx.actions`,
 * o único jeito de escrever em `useDataStore`) e nunca o `AIProvider`.
 */
export interface Action {
  execute(ctx: NovaContext): NovaActionResult[];
}
