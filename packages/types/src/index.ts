/**
 * Tipos compartilhados do CONTROL OS.
 *
 * Estes tipos espelham os conceitos definidos na documentação de produto
 * (Etapas 1–6): Control Spaces™, Missões™, Timeline Inteligente, Nova™.
 * Fase 1: usados apenas para tipar dados mockados no frontend. Quando
 * apps/api ganhar os schemas Pydantic reais (Fase 2+), estes tipos devem
 * continuar espelhando `apps/api/app/schemas`.
 */

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: string;
  company?: string;
  plan: 'starter' | 'pro' | 'enterprise';
  createdAt: string;
}

/**
 * Nomes válidos de ícone, sincronizados manualmente com as chaves de
 * `ICON_MAP` em `apps/web/components/layout/icon-map.tsx`. Mantido aqui
 * (em vez de `typeof ICON_MAP` importado do app) porque `packages/types`
 * não depende do React/lucide-react — é consumido também por `apps/api`
 * como referência de contrato.
 */
export type IconName =
  | 'LayoutGrid'
  | 'Sparkles'
  | 'Activity'
  | 'Target'
  | 'FolderKanban'
  | 'FileText'
  | 'BookOpen'
  | 'Wallet'
  | 'User'
  | 'Building2'
  | 'Users'
  | 'ChevronsLeft'
  | 'ChevronsRight'
  | 'Search'
  | 'Bell'
  | 'Command'
  | 'Plus'
  | 'LogOut'
  | 'Settings'
  | 'Menu'
  | 'CalendarClock'
  | 'Trophy'
  | 'Repeat'
  | 'Landmark'
  | 'Plane'
  | 'NotebookText'
  | 'Gauge'
  | 'ArrowLeftRight'
  | 'CreditCard'
  | 'Layers3'
  | 'BarChart3';

export type MissionStatus = 'planejamento' | 'em_andamento' | 'em_risco' | 'concluida';

/**
 * Diferencia a intenção original que criou a Missão — sem duplicar o tipo.
 * Opcional porque Missão existe desde antes deste campo (CONTROL OS 3.0);
 * usado hoje pela página Metas (`kind === 'meta'`), que reaproveita a mesma
 * fonte de dados de Missões em vez de criar um tipo `Goal` à parte.
 */
export type MissionKind = 'lembrete' | 'meta' | 'projeto';

/** Missão™ — unidade central de trabalho (Intenção → Missão → Objetivos → Execuções → Resultados). */
export interface Mission {
  id: string;
  title: string;
  spaceId: string;
  status: MissionStatus;
  progress: number; // 0–100
  dueDate?: string;
  objectivesTotal: number;
  objectivesDone: number;
  kind?: MissionKind;
}

/**
 * CONTROL OS — Fase 7 (Financeiro completo): `'transferencia'` adicionada
 * ao union original (`'receita' | 'despesa'`) — extensão aditiva, todo
 * `switch`/comparação existente que já tratava só os dois primeiros valores
 * continua compilando (nenhum deles é `never`-exaustivo sobre este tipo
 * hoje), e todos foram auditados e atualizados nesta fase para o terceiro
 * caso. Uma transferência entre contas usa este terceiro `type` (nunca
 * `'receita'`/`'despesa`) de propósito: mantém `getSummary`/`getBalance`
 * (que somam só receita/despesa) automaticamente corretos sem nenhum
 * filtro extra — "transferência não deve alterar o patrimônio total" sai
 * de graça, sem código especial, porque a soma nunca inclui `transferencia`.
 */
export type FinanceEntryType = 'receita' | 'despesa' | 'transferencia';

/** Direção de uma perna de transferência — só preenchido quando `FinanceEntry.type === 'transferencia'`. Cada transferência gera DUAS `FinanceEntry` (uma por conta), ligadas por `transferGroupId`, uma com `'saida'` (débito na conta de origem) e outra com `'entrada'` (crédito na conta de destino). */
export type FinanceTransferDirection = 'entrada' | 'saida';
export type FinanceTransactionStatus = 'pendente' | 'confirmada' | 'cancelada' | 'estornada';
export type FinanceTransactionSource = 'manual' | 'nova' | 'whatsapp' | 'api';

/** Frequência de uma recorrência (CONTROL OS — Fase 7). "Preparar arquitetura para geração automática futura. Ainda não criar scheduler" — só o rótulo é gravado (`FinanceEntry.recurrenceFrequency`); nenhum gerador roda ainda. */
export type FinanceRecurrenceFrequency = 'mensal' | 'semanal' | 'anual';

/**
 * Lançamento financeiro (CONTROL OS 3.0 / NOVA). Cobre tanto registros
 * criados via navegação manual (módulo Financeiro) quanto os criados pela
 * Nova em conversa (ex.: "Gastei R$ 35 no almoço") — mesma fonte de dados,
 * sem duplicação de tipo entre os dois modos.
 *
 * CONTROL OS — Fase 7: campos novos abaixo são TODOS opcionais — nenhum
 * `FinanceEntry` já existente em qualquer mock/teste/consumidor precisa
 * mudar para continuar compilando ("preservar compatibilidade").
 */
export interface FinanceEntry {
  id: string;
  type: FinanceEntryType;
  description: string;
  amount: number;
  category: string;
  /** Categoria persistida que originou o rótulo. Mantém o texto legado para compatibilidade. */
  categoryId?: string;
  date: string;
  spaceId?: string;
  /** Conta à qual este lançamento pertence (`FinanceAccount.id`). Quando a origem não informa a conta, o FinanceService só a infere se houver exatamente uma conta ativa; ele nunca cria uma conta automaticamente. */
  accountId?: string;
  /** Liga as DUAS pernas de uma mesma transferência (`type === 'transferencia'`). */
  transferGroupId?: string;
  /** Só preenchido quando `type === 'transferencia'` — ver `FinanceTransferDirection`. */
  transferDirection?: FinanceTransferDirection;
  /** Liga todos os lançamentos de um mesmo parcelamento (ex.: as 12 parcelas de um notebook). */
  installmentGroupId?: string;
  /** Número desta parcela dentro do grupo (1-based). */
  installmentNumber?: number;
  /** Total de parcelas do grupo. */
  installmentTotal?: number;
  /** Presente quando este lançamento é a origem de uma recorrência (mensal/semanal/anual) — só o rótulo, sem geração automática ainda. */
  recurrenceFrequency?: FinanceRecurrenceFrequency;
  /** Sprint 2.1: ciclo de vida e datas financeiras. `date` permanece como
   * alias legado de competência para não quebrar consumidores antigos. */
  status?: FinanceTransactionStatus;
  competenceDate?: string;
  dueDate?: string;
  paidAt?: string;
  confirmedAt?: string;
  canceledAt?: string;
  reversalOfId?: string;
  idempotencyKey?: string;
  correlationId?: string;
  source?: FinanceTransactionSource;
}

/**
 * Conta financeira (CONTROL OS — Fase 7). "Criar suporte para múltiplas
 * contas... Carteira, Conta Corrente, Poupança, Nubank, Inter, Caixa,
 * Cartão de Crédito" — `name` é o rótulo livre do exemplo ("Nubank"),
 * `kind` é uma classificação opcional pra agrupamento futuro (Dashboard) —
 * nenhuma tela ainda lê `kind` para decidir comportamento.
 */
export type FinanceAccountKind = 'carteira' | 'conta_corrente' | 'poupanca' | 'cartao_credito' | 'outro';
export type FinanceAccountStatus = 'ativa' | 'arquivada';

export interface FinanceAccount {
  id: string;
  name: string;
  kind: FinanceAccountKind;
  /** ISO 4217. A moeda pertence à conta, nunca ao saldo calculado. */
  currency: string;
  status: FinanceAccountStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

/**
 * Categoria financeira. Lançamentos novos guardam `categoryId` apontando
 * para este catálogo; o texto `FinanceEntry.category` fica como snapshot
 * histórico para preservar relatórios após uma categoria ser renomeada.
 */
export interface FinanceCategory {
  id: string;
  name: string;
  kind?: FinanceEntryType;
  icon: string;
  color: string;
  status: 'ativa' | 'arquivada';
  /** Menor valor aparece primeiro dentro do mesmo grupo. */
  sortOrder: number;
  /** Atalho de seleção; não altera a natureza financeira da categoria. */
  isFavorite: boolean;
  createdAt: string;
  updatedAt?: string;
  archivedAt?: string;
  /** `true` para um modelo padrão ainda não materializado no catálogo do usuário. */
  isDefault?: boolean;
}

/**
 * Dívida (CONTROL OS — Etapa 3, Financeiro avançado). Diferente de
 * `FinanceEntry` (um lançamento pontual), uma dívida tem ciclo de vida
 * próprio — saldo que diminui a cada parcela paga. Criada tanto por
 * conversa com a Nova ("Tenho uma dívida de R$ 3.000 em 10x") quanto
 * manualmente no módulo Financeiro; mesma fonte de dados nos dois casos.
 */
export interface Debt {
  id: string;
  description: string;
  totalAmount: number;
  remainingAmount: number;
  installmentsTotal: number;
  installmentsPaid: number;
  category: string;
  spaceId?: string;
}

/**
 * Hábito (CONTROL OS — Sistema Operacional Pessoal). `last7Days` guarda os
 * últimos 7 dias (do mais antigo pro mais recente, índice 6 = hoje) — dá
 * pra desenhar o "acompanhamento visual" pedido sem precisar de um log de
 * datas completo nesta fase (ainda toda mockada).
 */
export interface Habit {
  id: string;
  title: string;
  category: string;
  streakDays: number;
  completedToday: boolean;
  last7Days: boolean[];
  spaceId?: string;
}

/**
 * Documento pessoal (CONTROL OS — Sistema Operacional Pessoal). Chamado
 * `PersonalDocument`, não `Document` — esse nome já é o tipo global do DOM
 * em TypeScript, usado em outros pontos do app (ex.: `NovaOrb`).
 */
export interface PersonalDocument {
  id: string;
  title: string;
  category: string;
  addedAt: string;
  expiresAt?: string;
  spaceId?: string;
}

/** Bem patrimonial (CONTROL OS — Sistema Operacional Pessoal). */
export interface Asset {
  id: string;
  name: string;
  category: string;
  estimatedValue: number;
  purchaseDate?: string;
  warrantyUntil?: string;
  spaceId?: string;
}

/** Item de checklist genérico — reaproveitado por Viagens e Notas (tipo checklist). */
export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

/** Viagem (CONTROL OS — Sistema Operacional Pessoal). */
export interface Trip {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget?: number;
  checklist: ChecklistItem[];
  spaceId?: string;
}

export type NoteType = 'texto' | 'checklist';

/**
 * Nota pessoal (CONTROL OS — Sistema Operacional Pessoal). `content` é
 * usado quando `type === 'texto'`; `checklistItems`, quando
 * `type === 'checklist'` — só um dos dois é preenchido por nota.
 */
export interface Note {
  id: string;
  title: string;
  type: NoteType;
  category: string;
  createdAt: string;
  content?: string;
  checklistItems?: ChecklistItem[];
  spaceId?: string;
}

/**
 * Compromisso de agenda (CONTROL OS 3.0 / NOVA). `linkedMissionId` permite
 * que um compromisso criado em conversa (ex.: "Tenho reunião amanhã às 15h")
 * também gere um lembrete via Missão, sem duplicar o conceito — a Missão
 * continua sendo a unidade central de lembretes/metas/projetos.
 */
export interface AgendaEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  spaceId?: string;
  linkedMissionId?: string;
}

export type TimelineEventType =
  | 'missao_criada'
  | 'missao_concluida'
  | 'execucao'
  | 'mensagem_nova'
  | 'documento'
  | 'financeiro'
  | 'agenda_criada'
  | 'sistema';

/** Evento da Timeline Inteligente (Control Feed™). */
export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  timestamp: string;
  spaceId?: string;
  actor: 'user' | 'nova' | 'sistema';
}

/** Mensagem trocada com a Nova™ no AI Workspace. */
export interface NovaMessage {
  id: string;
  role: 'user' | 'nova';
  content: string;
  timestamp: string;
}

/** Cartão de estatística do Dashboard Vivo™. */
export interface DashboardStat {
  id: string;
  label: string;
  value: string;
  delta?: string;
  trend?: 'up' | 'down' | 'neutral';
  accent: 'green' | 'blue' | 'purple' | 'red';
}

/** Item de navegação da Sidebar. */
export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: IconName;
  badge?: number;
}
