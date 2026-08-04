import type { NovaIntentKind, NovaReadOnlyContext } from '../interfaces';

/**
 * Catálogo de eventos do NOVA CORE (CONTROL OS — Etapa 7: IA-Native — Event
 * Bus). Um tipo por domínio que a NOVA já sabe criar de verdade via Tool —
 * mesma correspondência 1:1 com os 12 `NovaIntentKind` acionáveis (ver
 * `services/ai/tools/schemas.ts`). Intents de consulta (`consultar_dividas`,
 * `consultar_dia`) e `desconhecido` nunca escrevem dado nenhum, então nunca
 * publicam evento — ver `eventTypeForIntentKind` abaixo.
 *
 * Nomeado o mais perto possível do exemplo do spec da Etapa 7, com duas
 * diferenças conscientes, documentadas aqui porque um leitor comparando com
 * o spec vai notar:
 *   - `HabitCreated` (não `HabitCompleted`): hoje só existe Action de criar
 *     hábito (`CreateHabitAction`) — marcar um hábito como concluído é uma
 *     interação direta da tela de Hábitos contra `useDataStore`, sem passar
 *     por Intent/Action nenhuma. Nomear o evento como "Completed" seria
 *     descrever algo que este pipeline não observa de verdade.
 *   - `DebtCreated` (adicionado, não está no exemplo do spec): dívida é um
 *     domínio real com Action real (via `runIntent`/`createDebt`, mesmo
 *     choke point dos demais) — ficaria estranho ele ser o único domínio
 *     real sem evento correspondente.
 * `MissionCompleted`/`AssetUpdated`/`AgendaUpdated` (mencionados na seção
 * "NOVA CORE" do spec) não têm Action correspondente hoje (conclusão de
 * missão e edição de patrimônio/agenda são interações diretas das telas) —
 * por isso não entraram no catálogo; ver o relatório final desta etapa.
 */
export type NovaEventType =
  | 'ExpenseCreated'
  | 'IncomeCreated'
  | 'ReminderCreated'
  | 'AppointmentCreated'
  | 'GoalCreated'
  | 'ProjectCreated'
  | 'DebtCreated'
  | 'FinancialContractCreated'
  | 'HabitCreated'
  | 'TripCreated'
  | 'DocumentCreated'
  | 'AssetCreated'
  | 'NoteCreated';

/**
 * Um evento publicado no Event Bus. `summary` reaproveita o `detail` que já
 * ia pro usuário (`NovaActionResult.detail`) — nunca um payload novo com
 * mais dado do que o necessário. `context` é o snapshot somente-leitura do
 * `NovaContext` no momento em que o evento foi publicado (já com a escrita
 * deste turno refletida) — é o que permite ao `NovaObserver`/
 * `RecommendationEngine` analisar dado real sem precisar saber buscar dado
 * sozinho.
 */
export interface NovaEvent {
  type: NovaEventType;
  occurredAt: string;
  summary: string;
  sessionId: string;
  context: NovaReadOnlyContext;
}

/**
 * Mapeia a intent que gerou uma escrita bem-sucedida pro tipo de evento
 * correspondente. `undefined` para intents de consulta/desconhecida — nunca
 * escrevem, nunca publicam. Switch exaustivo (sem `default`): se um
 * `NovaIntentKind` novo for adicionado no futuro sem passar por aqui, o
 * `tsc` acusa o erro, nunca falha silenciosamente em runtime.
 */
export function eventTypeForIntentKind(kind: NovaIntentKind): NovaEventType | undefined {
  switch (kind) {
    case 'registrar_despesa':
      return 'ExpenseCreated';
    case 'registrar_receita':
      return 'IncomeCreated';
    case 'criar_lembrete':
      return 'ReminderCreated';
    case 'criar_agenda':
      return 'AppointmentCreated';
    case 'criar_objetivo':
      return 'GoalCreated';
    case 'criar_projeto':
      return 'ProjectCreated';
    case 'registrar_divida':
      return 'DebtCreated';
    case 'criar_emprestimo':
    case 'criar_financiamento':
      return 'FinancialContractCreated';
    case 'criar_habito':
      return 'HabitCreated';
    case 'criar_viagem':
      return 'TripCreated';
    case 'criar_documento':
      return 'DocumentCreated';
    case 'criar_bem':
      return 'AssetCreated';
    case 'criar_nota':
      return 'NoteCreated';
    case 'consultar_dividas':
    case 'consultar_dia':
    case 'excluir_agenda':
    case 'transferir_conta':
    case 'parcelar_despesa':
    case 'pagar_conta_fixa':
    case 'consultar_contas_vencendo':
    case 'desconhecido':
      return undefined;
  }
}
