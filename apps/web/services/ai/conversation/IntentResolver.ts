import type { NovaIntent } from '@/services/nova';
import {
  CreateAppointmentAction,
  CreateExpenseAction,
  CreateGoalAction,
  CreateIncomeAction,
  CreateReminderAction,
  type Action,
} from '../actions';

/**
 * Traduz um `NovaIntent` (identificado pelo `AIProvider`) na Action
 * correspondente (CONTROL OS — Preparação para OpenAI GPT-5.5). Passo
 * intermediário explícito na cadeia Nova → ConversationService →
 * AIProvider → IntentResolver → ActionExecutor → Banco de Dados.
 *
 * `criar_projeto`, `registrar_divida` e as intents de consulta
 * (`consultar_dividas`, `consultar_dia`, `desconhecido`) não têm Action
 * dedicada nesta fase — não fazem parte da lista de 10 Actions pedida
 * ("Preparação para OpenAI GPT-5.5"). O `ActionExecutor` sabe cair de volta
 * pro executor legado (`runIntent`, já testado) nesses casos, preservando
 * 100% do comportamento atual.
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
        return new CreateGoalAction({ title: intent.title });
      case 'criar_projeto':
      case 'registrar_divida':
      case 'consultar_dividas':
      case 'consultar_dia':
      case 'desconhecido':
        return undefined;
    }
  }
}
