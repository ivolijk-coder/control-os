import type { AgendaEvent, Debt, FinanceEntry, Habit, Mission, TimelineEvent } from '@control-os/types';

/**
 * Contratos do NOVA Operating System (CONTROL OS 3.0).
 *
 * Este módulo é a "camada Nova": toda mensagem do usuário passa por
 * intent → planner → executor, sempre contra a mesma fonte de dados que a
 * navegação manual usa (`useDataStore`, em `apps/web/lib/data-store.ts`).
 * Os tipos aqui não dependem do React nem do Zustand diretamente — apenas
 * do formato de dados (`NovaDataActions`) — para que o mesmo pipeline possa
 * rodar tanto a partir do `NovaWorkspace` (UI) quanto, futuramente, de um
 * canal externo (ex.: WhatsApp), sem duplicar a lógica de negócio.
 */

export type NovaIntentKind =
  | 'registrar_despesa'
  | 'registrar_receita'
  | 'criar_lembrete'
  | 'criar_agenda'
  | 'criar_objetivo'
  | 'criar_projeto'
  | 'registrar_divida'
  | 'consultar_dividas'
  | 'consultar_dia'
  | 'desconhecido';

interface NovaIntentBase {
  raw: string;
}

export interface ExpenseIntent extends NovaIntentBase {
  kind: 'registrar_despesa';
  amount: number;
  description: string;
}

export interface RevenueIntent extends NovaIntentBase {
  kind: 'registrar_receita';
  amount: number;
  description: string;
}

export interface ReminderIntent extends NovaIntentBase {
  kind: 'criar_lembrete';
  title: string;
}

export interface AgendaIntent extends NovaIntentBase {
  kind: 'criar_agenda';
  title: string;
  time?: string;
}

export interface GoalIntent extends NovaIntentBase {
  kind: 'criar_objetivo';
  title: string;
}

export interface ProjectIntent extends NovaIntentBase {
  kind: 'criar_projeto';
  title: string;
}

export interface DebtIntent extends NovaIntentBase {
  kind: 'registrar_divida';
  totalAmount: number;
  installments: number;
  description: string;
}

/** "Quanto eu devo?" / "minhas dívidas" — intenção de leitura, sem passos de execução. */
export interface ConsultDebtsIntent extends NovaIntentBase {
  kind: 'consultar_dividas';
}

/** "O que preciso fazer hoje?" / "Organize meu dia" — intenção de leitura, sem passos de execução. */
export interface ConsultDayPlanIntent extends NovaIntentBase {
  kind: 'consultar_dia';
}

export interface UnknownIntent extends NovaIntentBase {
  kind: 'desconhecido';
}

/** União discriminada por `kind` — todo consumidor pode usar `switch` exaustivo sem type cast. */
export type NovaIntent =
  | ExpenseIntent
  | RevenueIntent
  | ReminderIntent
  | AgendaIntent
  | GoalIntent
  | ProjectIntent
  | DebtIntent
  | ConsultDebtsIntent
  | ConsultDayPlanIntent
  | UnknownIntent;

export type NovaActionKind =
  | 'criar_despesa'
  | 'criar_receita'
  | 'criar_missao'
  | 'criar_evento_agenda'
  | 'criar_divida'
  | 'registrar_timeline';

/** Um passo do plano (checklist) — declarativo, ainda sem execução. */
export interface NovaAction {
  kind: NovaActionKind;
  label: string;
}

/** Resultado de um passo já executado contra `useDataStore`. */
export interface NovaActionResult {
  action: NovaAction;
  ok: boolean;
  detail?: string;
}

/** Subconjunto de ações do `useDataStore` que a Nova precisa para agir. */
export interface NovaDataActions {
  addMission: (mission: Omit<Mission, 'id'>) => Mission;
  updateMission: (id: string, patch: Partial<Omit<Mission, 'id'>>) => void;
  addTimelineEvent: (event: Omit<TimelineEvent, 'id'>) => TimelineEvent;
  addFinanceEntry: (entry: Omit<FinanceEntry, 'id'>) => FinanceEntry;
  addAgendaEvent: (event: Omit<AgendaEvent, 'id'>) => AgendaEvent;
  addDebt: (debt: Omit<Debt, 'id'>) => Debt;
}

export interface NovaContext {
  actions: NovaDataActions;
  /** Space padrão para lançamentos criados por conversa (Fase 1: fixo, sem seleção manual ainda). */
  defaultSpaceId: string;
  /**
   * Snapshot somente-leitura para intents de consulta (ex.: "quanto eu
   * devo?", "o que preciso fazer hoje?"). Diferente de `actions` (que
   * sempre escreve em `useDataStore`), isto é passado pelo chamador
   * (`NovaWorkspace`) a cada turno — mesmo princípio de "sem estado próprio
   * dentro de services/nova".
   */
  debts: Debt[];
  missions: Mission[];
  agendaEvents: AgendaEvent[];
  financeEntries: FinanceEntry[];
  habits: Habit[];
}

export type NovaStatus = 'pensando' | 'executando' | 'concluido' | 'erro';

export interface NovaTurnResult {
  status: NovaStatus;
  reply: string;
  checklist: string[];
  results: NovaActionResult[];
}
