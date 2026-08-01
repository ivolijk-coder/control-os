import type {
  AgendaEvent,
  Asset,
  Debt,
  FinanceEntry,
  Habit,
  Mission,
  Note,
  PersonalDocument,
  TimelineEvent,
  Trip,
} from '@control-os/types';

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

/**
 * CONTROL OS — Etapa 15 (LEGENDARY): duas inteligências especializadas, uma
 * única infraestrutura. `NovaPersona` NÃO é um segundo provider, um segundo
 * `ConversationService` ou um segundo histórico — é só o parâmetro que
 * decide qual identidade (`SystemPrompt`, cor, comportamento da `NovaOrb`)
 * conduz o MESMO pipeline (intent → planner → executor → mesma memória,
 * mesmo Event Bus, mesmo Tool Calling) já usado por tudo em `services/nova`
 * e `services/ai`. `'nova'`: organiza, executa, administra — pensa como um
 * Sistema Operacional. `'legendary'`: desenvolve o usuário (disciplina,
 * consistência, hábitos, energia, foco, mentalidade, propósito) a partir
 * dos mesmos dados reais — nunca cria dado novo, nunca duplica heurística.
 */
export type NovaPersona = 'nova' | 'legendary';

/**
 * CONTROL OS — Fase 7 (Financeiro completo): `transferir_conta`/
 * `parcelar_despesa` adicionados. Diferente de `registrar_divida`
 * (`Debt` — ciclo de vida próprio, saldo que diminui a cada parcela paga,
 * `services/nova/actions/create-debt.ts` — inalterado, "parcelei"/"tenho
 * uma dívida"), `parcelar_despesa` é um parcelamento de FINANÇAS
 * (`FinanceEntry`, N lançamentos ligados por `installmentGroupId`, ver
 * `services/modules/finance`) — "parcela"/"parcelar" (imperativo/infinitivo),
 * nunca a mesma forma verbal de `registrar_divida` ("parcelei", passado),
 * então os dois padrões de regex nunca colidem (`parser.ts`).
 */
export type NovaIntentKind =
  | 'registrar_despesa'
  | 'registrar_receita'
  | 'transferir_conta'
  | 'parcelar_despesa'
  | 'criar_lembrete'
  | 'criar_agenda'
  | 'excluir_agenda'
  | 'criar_objetivo'
  | 'criar_projeto'
  | 'registrar_divida'
  | 'criar_habito'
  | 'criar_viagem'
  | 'criar_documento'
  | 'criar_bem'
  | 'criar_nota'
  | 'consultar_dividas'
  | 'consultar_dia'
  | 'pagar_conta_fixa'
  | 'consultar_contas_vencendo'
  | 'desconhecido';

interface NovaIntentBase {
  raw: string;
}

export interface ExpenseIntent extends NovaIntentBase {
  kind: 'registrar_despesa';
  amount: number;
  description: string;
  /** Conta mencionada pelo usuário. Quando ausente, o FinanceService só
   * resolve automaticamente se houver exatamente uma conta ativa. */
  accountName?: string;
  /** Categoria mencionada pelo usuário; Alimentação continua sendo o padrão
   * seguro para despesas de mercado quando nenhuma categoria for informada. */
  category?: string;
}

export interface RevenueIntent extends NovaIntentBase {
  kind: 'registrar_receita';
  amount: number;
  description: string;
}

/** "Transferi R$ 1.000 para o Nubank" (CONTROL OS — Fase 7). `fromAccountName` quase nunca é dito — a conta de origem, quando ausente, cai na conta padrão do usuário (`FinanceService.createTransfer`). */
export interface TransferIntent extends NovaIntentBase {
  kind: 'transferir_conta';
  amount: number;
  toAccountName: string;
  fromAccountName?: string;
}

/** "Parcela esse notebook em 12x" (CONTROL OS — Fase 7) — parcelamento de FINANÇAS (`FinanceEntry`), não confundir com `DebtIntent`/`registrar_divida` (dívida com ciclo de vida próprio). */
export interface InstallmentIntent extends NovaIntentBase {
  kind: 'parcelar_despesa';
  totalAmount: number;
  installments: number;
  description: string;
}

export interface ReminderIntent extends NovaIntentBase {
  kind: 'criar_lembrete';
  title: string;
  /**
   * CONTROL OS — Etapa 14 (Execution Engine): antes deste campo, "Me lembra
   * de pagar o IPVA amanhã às 9" perdia a data mencionada — o lembrete
   * nascia sem nenhum vínculo de quando. Prazo em ISO (`YYYY-MM-DD`), quando
   * o usuário menciona um (mesmo padrão de `GoalIntent.dueDate`).
   */
  dueDate?: string;
  /** Horário no formato `HH:MM`, quando mencionado (ex.: "às 9h" → "09:00"). */
  time?: string;
}

export interface AgendaIntent extends NovaIntentBase {
  kind: 'criar_agenda';
  title: string;
  time?: string;
  /**
   * CONTROL OS — Etapa 14 (Execution Engine): antes deste campo, todo
   * compromisso criado por conversa nascia com a data de hoje, mesmo quando
   * o usuário dizia "sexta" ou "semana que vem" — a data mencionada era
   * descartada. Data em ISO (`YYYY-MM-DD`); quando ausente, o compromisso
   * continua caindo em hoje (mesmo comportamento de antes).
   */
  date?: string;
}

/** Remove um compromisso específico da agenda. O ID só vem do contexto real enviado à IA. */
export interface DeleteAgendaIntent extends NovaIntentBase {
  kind: 'excluir_agenda';
  eventId: string;
  title: string;
}

export interface GoalIntent extends NovaIntentBase {
  kind: 'criar_objetivo';
  title: string;
  /**
   * Prazo da meta em ISO (`YYYY-MM-DD`), quando o usuário menciona um (ex.:
   * "até dezembro"). Teste de uso real (30 min como usuária pagante): antes
   * este campo não existia — o prazo dito por voz/texto era descartado, e a
   * meta criada nunca aparecia no Roadmap de `/metas` (que só lista metas
   * com `dueDate`). Opcional: nem toda meta tem prazo definido.
   */
  dueDate?: string;
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

/**
 * As 5 intents abaixo (CONTROL OS — Etapa 5: OpenAI GPT-5.5 como cérebro da
 * NOVA) cobrem domínios cujas Actions já existiam desde a preparação para
 * OpenAI (`services/ai/actions/create-habit-action.ts` etc.) mas nunca
 * tinham intent/tool correspondente — gap identificado na auditoria da
 * Etapa 4.5 ("📈 antes da Etapa 5") e agora necessário de verdade: o
 * exemplo "Quero viajar para Portugal" do spec da Etapa 5 espera que a NOVA
 * proponha meta + viagem + lembrete, dependendo do contexto.
 */
export interface HabitIntent extends NovaIntentBase {
  kind: 'criar_habito';
  title: string;
  category?: string;
}

export interface TripIntent extends NovaIntentBase {
  kind: 'criar_viagem';
  destination: string;
  startDate: string;
  endDate: string;
  budget?: number;
}

export interface DocumentIntent extends NovaIntentBase {
  kind: 'criar_documento';
  title: string;
  category?: string;
  expiresAt?: string;
}

export interface AssetIntent extends NovaIntentBase {
  kind: 'criar_bem';
  name: string;
  estimatedValue: number;
  category?: string;
}

export interface NoteIntent extends NovaIntentBase {
  kind: 'criar_nota';
  title: string;
  content: string;
  category?: string;
}

/** "Quanto eu devo?" / "minhas dívidas" — intenção de leitura, sem passos de execução. */
export interface ConsultDebtsIntent extends NovaIntentBase {
  kind: 'consultar_dividas';
}

/** "O que preciso fazer hoje?" / "Organize meu dia" — intenção de leitura, sem passos de execução. */
export interface ConsultDayPlanIntent extends NovaIntentBase {
  kind: 'consultar_dia';
}

/** Baixa uma ocorrência existente; a confirmação é obrigatória antes da execução. */
export interface PayFixedAccountIntent extends NovaIntentBase {
  kind: 'pagar_conta_fixa';
  name: string;
}

/** Consulta contas pendentes cujo vencimento está próximo, sem alterar dados. */
export interface ConsultFixedAccountDueIntent extends NovaIntentBase {
  kind: 'consultar_contas_vencendo';
  period: 'amanha' | 'semana';
}

export interface UnknownIntent extends NovaIntentBase {
  kind: 'desconhecido';
}

/** União discriminada por `kind` — todo consumidor pode usar `switch` exaustivo sem type cast. */
export type NovaIntent =
  | ExpenseIntent
  | RevenueIntent
  | TransferIntent
  | InstallmentIntent
  | ReminderIntent
  | AgendaIntent
  | DeleteAgendaIntent
  | GoalIntent
  | ProjectIntent
  | DebtIntent
  | HabitIntent
  | TripIntent
  | DocumentIntent
  | AssetIntent
  | NoteIntent
  | ConsultDebtsIntent
  | ConsultDayPlanIntent
  | PayFixedAccountIntent
  | ConsultFixedAccountDueIntent
  | UnknownIntent;

export type NovaActionKind =
  | 'criar_despesa'
  | 'criar_receita'
  // CONTROL OS — Fase 7 (Financeiro completo): transferência e parcelamento
  // do chat real não escrevem em `useDataStore` (só persistem via
  // `services/ai/finance-bridge.ts` -> `app/api/finance/actions` -> Prisma)
  // — ver `CreateTransferAction`/`CreateInstallmentAction` em `services/ai/actions`.
  | 'criar_transferencia'
  | 'criar_parcelamento'
  | 'pagar_conta_fixa'
  | 'consultar_contas_vencendo'
  | 'criar_missao'
  | 'criar_evento_agenda'
  | 'excluir_evento_agenda'
  | 'criar_divida'
  | 'criar_habito'
  | 'criar_viagem'
  // CONTROL OS — Etapa 14 (Execution Engine): sub-efeitos de `criar_viagem`
  // quando a NOVA encadeia checklist/orçamento na mesma execução (ver
  // `CreateTripAction`) — cada um vira seu próprio `NovaActionResult`, mesmo
  // padrão já usado por `criar_evento_agenda`/`criar_missao` (que também
  // não são "a ação inteira", só um efeito de uma execução maior).
  | 'criar_checklist_viagem'
  | 'sugerir_orcamento_viagem'
  | 'criar_documento'
  | 'criar_bem'
  | 'criar_nota'
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

/**
 * Subconjunto de ações do `useDataStore` que a Nova precisa para agir.
 *
 * Estendido (CONTROL OS — Preparação para OpenAI GPT-5.5) com
 * `addHabit`/`addDocument`/`addAsset`/`addTrip`/`addNote` — usados pelas
 * novas Actions em `services/ai/actions/` (`CreateHabitAction`,
 * `CreateDocumentAction`, `CreateAssetAction`, `CreateTripAction`,
 * `CreateNoteAction`). Extensão aditiva: nada que já consumia
 * `NovaDataActions` (ex.: `services/nova/executor`) precisa dos novos
 * campos, então nenhum comportamento existente muda.
 */
export interface NovaDataActions {
  addMission: (mission: Omit<Mission, 'id'>) => Mission;
  updateMission: (id: string, patch: Partial<Omit<Mission, 'id'>>) => void;
  addTimelineEvent: (event: Omit<TimelineEvent, 'id'>) => TimelineEvent;
  addFinanceEntry: (entry: Omit<FinanceEntry, 'id'>) => FinanceEntry;
  addAgendaEvent: (event: Omit<AgendaEvent, 'id'>) => AgendaEvent;
  deleteAgendaEvent: (id: string) => void;
  addDebt: (debt: Omit<Debt, 'id'>) => Debt;
  addHabit: (habit: Omit<Habit, 'id'>) => Habit;
  addDocument: (document: Omit<PersonalDocument, 'id'>) => PersonalDocument;
  addAsset: (asset: Omit<Asset, 'id'>) => Asset;
  addTrip: (trip: Omit<Trip, 'id'>) => Trip;
  addNote: (note: Omit<Note, 'id'>) => Note;
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
  /**
   * Adicionados na Etapa 4 (Preparação profissional para OpenAI GPT-5.5) —
   * o contexto enviado a um provedor de IA real precisa cobrir todos os
   * domínios do CONTROL OS, não só os que já tinham intent conversacional.
   */
  trips: Trip[];
  documents: PersonalDocument[];
  assets: Asset[];
  notes: Note[];
  /**
   * Adicionado na Etapa 13 (NOVA Proativa) — `Mission` não tem campo de
   * criação (`createdAt`); a Timeline (`addTimelineEvent`, sempre escrita
   * ao criar uma missão/meta/projeto, ver `create-mission.ts`) é a única
   * fonte real de "quando isso foi criado", necessária pro acompanhamento
   * ("meta criada há alguns dias, ainda sem conclusão"). Só leitura — a
   * escrita já existia (`actions.addTimelineEvent`), só nunca tinha sido
   * exposta de volta pro lado que só lê.
   */
  timeline: TimelineEvent[];
  /** Primeiro nome do usuário — usado pra personalizar a resposta de "olá"/plano do dia. */
  userName: string;
}

/**
 * `'aguardando_confirmacao'` (CONTROL OS — Evolução da experiência NOVA):
 * a intenção já foi identificada, mas é sensível o bastante (valor alto,
 * cria uma dívida) para não executar sem o usuário confirmar antes. A
 * `Action` já resolvida fica guardada em `ConversationService` até a
 * confirmação (ou o cancelamento) chegar.
 */
export type NovaStatus = 'pensando' | 'executando' | 'concluido' | 'erro' | 'aguardando_confirmacao';

export interface NovaTurnResult {
  status: NovaStatus;
  reply: string;
  checklist: string[];
  results: NovaActionResult[];
}

/**
 * Projeção somente-leitura de `NovaContext` (CONTROL OS — Etapa 7: IA-Native
 * — Event Bus). Usada como payload de `NovaEvent` e como entrada do
 * `RecommendationEngine`/`NovaObserver` — nunca carrega `actions` (a
 * superfície de escrita), porque um observador de evento só analisa dados,
 * nunca grava nada. `Omit`, não um tipo novo duplicado — qualquer campo que
 * `NovaContext` ganhar no futuro chega aqui automaticamente.
 */
export type NovaReadOnlyContext = Omit<NovaContext, 'actions'>;

/**
 * Converte um `NovaContext` real na sua projeção somente-leitura (CONTROL OS
 * — Etapa 9). Antes existia como função privada duplicada dentro de
 * `ConversationService.ts` (`toNovaReadOnlyContext`) — movida pra cá e
 * exportada porque a partir da Etapa 9 a própria Home (`NovaWorkspace`)
 * também precisa desta conversão pra chamar `generateRecommendations`/
 * `buildHomeInsights` com o mesmo contexto real, sem duplicar a lógica de
 * "remover `actions`" em dois lugares.
 */
export function toReadOnlyContext(ctx: NovaContext): NovaReadOnlyContext {
  const { actions: _actions, ...readOnly } = ctx;
  return readOnly;
}
