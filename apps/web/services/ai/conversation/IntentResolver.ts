import type { NovaIntent } from '@/services/nova';
import {
  CreateAppointmentAction,
  CreateAssetAction,
  CreateDocumentAction,
  CreateExpenseAction,
  CreateGoalAction,
  CreateHabitAction,
  CreateIncomeAction,
  CreateInstallmentAction,
  CreateNoteAction,
  CreateReminderAction,
  CreateTransferAction,
  CreateTripAction,
  ListFixedAccountOccurrencesAction,
  PayFixedAccountOccurrenceAction,
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
 *
 * `transferir_conta`/`parcelar_despesa` conectados na Fase 7 (Financeiro
 * completo): diferente de `CreateExpenseAction`/`CreateIncomeAction` (que só
 * gravam em `useDataStore`), `CreateTransferAction`/`CreateInstallmentAction`
 * NÃO tocam `useDataStore` — persistem só via `services/ai/finance-bridge.ts`
 * (fire-and-forget) contra o MESMO Action Engine do CONTROL HUB, ver doc de
 * cada classe em `services/ai/actions/`.
 */
export class IntentResolver {
  resolve(intent: NovaIntent): Action | undefined {
    switch (intent.kind) {
      case 'registrar_despesa':
        return new CreateExpenseAction({
          amount: intent.amount,
          description: intent.description,
          accountName: intent.accountName,
          category: intent.category,
        });
      case 'registrar_receita':
        return new CreateIncomeAction({ amount: intent.amount, description: intent.description });
      case 'transferir_conta':
        return new CreateTransferAction({
          amount: intent.amount,
          toAccountName: intent.toAccountName,
          fromAccountName: intent.fromAccountName,
        });
      case 'parcelar_despesa':
        return new CreateInstallmentAction({
          totalAmount: intent.totalAmount,
          installments: intent.installments,
          description: intent.description,
        });
      case 'criar_lembrete':
        return new CreateReminderAction({ title: intent.title, dueDate: intent.dueDate, time: intent.time });
      case 'criar_agenda':
        return new CreateAppointmentAction({ title: intent.title, time: intent.time, date: intent.date });
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
      case 'pagar_conta_fixa':
        return new PayFixedAccountOccurrenceAction(intent.name);
      case 'consultar_contas_vencendo':
        return new ListFixedAccountOccurrencesAction(intent.period);
      case 'criar_projeto':
      case 'registrar_divida':
      case 'excluir_agenda':
      case 'consultar_dividas':
      case 'consultar_dia':
      case 'desconhecido':
        return undefined;
    }
  }
}
