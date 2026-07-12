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
  | 'Menu';

/** Control Spaces™ — unidades de contexto (ex.: "Minha Vida", "Minha Empresa"). */
export interface ControlSpace {
  id: string;
  name: string;
  icon: IconName;
  color: 'green' | 'blue' | 'purple' | 'red';
  missionsCount: number;
  isActive: boolean;
}

export type MissionStatus = 'planejamento' | 'em_andamento' | 'em_risco' | 'concluida';

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
}

export type FinanceEntryType = 'receita' | 'despesa';

/**
 * Lançamento financeiro (CONTROL OS 3.0 / NOVA). Cobre tanto registros
 * criados via navegação manual (módulo Financeiro) quanto os criados pela
 * Nova em conversa (ex.: "Gastei R$ 35 no almoço") — mesma fonte de dados,
 * sem duplicação de tipo entre os dois modos.
 */
export interface FinanceEntry {
  id: string;
  type: FinanceEntryType;
  description: string;
  amount: number;
  category: string;
  date: string;
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
