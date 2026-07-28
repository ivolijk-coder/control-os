import type { NovaActionResult, NovaContext, NovaIntent } from '../interfaces';
import {
  createExpense,
  createRevenue,
  createAgendaEvent,
  deleteAgendaEvent,
  createGoal,
  createProject,
  createReminder,
  createDebt,
} from '../actions';

/**
 * Executa de fato uma intenção contra `useDataStore` (via `ctx.actions`),
 * despachando para a ferramenta correspondente. "Primeiro faz. Depois
 * responde." — o executor sempre roda antes de `conversation/` formular a
 * resposta em texto.
 */
export function runIntent(ctx: NovaContext, intent: NovaIntent): NovaActionResult[] {
  switch (intent.kind) {
    case 'registrar_despesa':
      return createExpense(ctx, intent);
    case 'registrar_receita':
      return createRevenue(ctx, intent);
    case 'criar_lembrete':
      return createReminder(ctx, intent);
    case 'criar_agenda':
      return createAgendaEvent(ctx, intent);
    case 'excluir_agenda':
      return deleteAgendaEvent(ctx, intent);
    case 'criar_objetivo':
      return createGoal(ctx, intent);
    case 'criar_projeto':
      return createProject(ctx, intent);
    case 'registrar_divida':
      return createDebt(ctx, intent);
    case 'criar_habito':
    case 'criar_viagem':
    case 'criar_documento':
    case 'criar_bem':
    case 'criar_nota':
    case 'transferir_conta':
    case 'parcelar_despesa':
    case 'pagar_conta_fixa':
    case 'consultar_contas_vencendo':
      // Nunca alcançado em runtime — `IntentResolver` (services/ai) sempre
      // resolve uma Action dedicada pra esses kinds (CONTROL OS — Etapa 5 /
      // Fase 7), então `ActionExecutor` nunca cai neste fallback legado pra
      // eles. Caso aqui só pra satisfazer o `switch` exaustivo.
      return [];
    case 'consultar_dividas':
    case 'consultar_dia':
      // Leitura — tratada direto em `conversation/`, sem passar por aqui.
      return [];
    case 'desconhecido':
      return [];
  }
}
