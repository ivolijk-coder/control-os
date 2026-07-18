import type { NovaIntent } from '@/services/nova';
import {
  CreateAppointmentAction,
  CreateAssetAction,
  CreateDocumentAction,
  CreateExpenseAction,
  CreateGoalAction,
  CreateHabitAction,
  CreateIncomeAction,
  CreateNoteAction,
  CreateReminderAction,
  CreateTripAction,
  type Action,
} from '../actions';

/**
 * Traduz um `NovaIntent` (identificado pelo `AIProvider`) na Action
 * correspondente (CONTROL OS — Preparação para OpenAI GPT-5.5 / Etapa 5).
 * Passo intermediário explícito na cadeia Nova → ConversationService →
 * AIProvider → IntentResolver → ActionExecutor → Banco de Dados.
 *
 * `criar_habito`/`criar_viagem`/`criar_documento`/`criar_bem`/`criar_nota`
 * conectados na Etapa 5 — as Actions já existiam desde a preparação para
 * OpenAI, mas nenhum `NovaIntentKind`/tool apontava para elas (gap
 * identificado na auditoria da Etapa 4.5). `criar_projeto`, `registrar_divida`
 * e as intents de consulta (`consultar_dividas`, `consultar_dia`,
 * `desconhecido`) continuam sem Action dedicada — o `ActionExecutor` cai de
 * volta pro executor legado (`runIntent`, já testado) nesses casos,
 * preservando 100% do comportamento atual.
 */
export class IntentResolver {
  resolve(intent: NovaIntent): Action | undefined {
    switch (intent.kind) {
      case 'registrar_despesa':
        return new CreateExpenseAction({ amount: intent.amount, description: intent.description });
      case 'registrar_receita':
        return new CreateIncomeAction({ amount: intent.amount, description: intent.description });
      case 'criar_lembrete':
        return new CreateReminderAction({ title: intent.title });
      case 'criar_agenda':
        return new CreateAppointmentAction({ title: intent.title, time: intent.time });
      case 'criar_objetivo':
        return new CreateGoalAction({ title: intent.title, dueDate: intent.dueDate });
      case 'criar_habito':
        return new CreateHabitAction({ title: intent.title, category: intent.category });
      case 'criar_viagem':
        return new CreateTripAction({
          destination: intent.destination,
          startDate: intent.startDate,
          endDate: intent.endDate,
          budget: intent.budget,
        });
      case 'criar_documento':
        return new CreateDocumentAction({ title: intent.title, category: intent.category, expiresAt: intent.expiresAt });
      case 'criar_bem':
        return new CreateAssetAction({ name: intent.name, estimatedValue: intent.estimatedValue, category: intent.category });
      case 'criar_nota':
        return new CreateNoteAction({ title: intent.title, content: intent.content, category: intent.category });
      case 'criar_projeto':
      case 'registrar_divida':
      case 'consultar_dividas':
      case 'consultar_dia':
      case 'desconhecido':
        return undefined;
    }
  }
}
