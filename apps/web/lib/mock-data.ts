import type {
  ControlSpace,
  DashboardStat,
  Mission,
  NavItem,
  NovaMessage,
  TimelineEvent,
  User,
} from '@control-os/types';

/**
 * Dados mockados da Fase 1.
 *
 * Nenhum destes dados vem de rede — servem para que as 6 telas desta fase
 * (Login, Cadastro, Dashboard, Sidebar, Topbar, Layout Principal) se
 * comportem de forma realista. Quando apps/api ganhar os endpoints reais,
 * este arquivo é substituído por chamadas via TanStack Query.
 */

export const MOCK_USER: User = {
  id: 'usr_001',
  name: 'Ivoli Jr',
  email: 'ivolijk@gmail.com',
  role: 'Fundador',
  company: 'Control Marketing',
  plan: 'pro',
  createdAt: '2025-11-02T10:00:00Z',
};

export const MOCK_SPACES: ControlSpace[] = [
  { id: 'sp_vida', name: 'Minha Vida', icon: 'User', color: 'blue', missionsCount: 4, isActive: true },
  { id: 'sp_empresa', name: 'Minha Empresa', icon: 'Building2', color: 'purple', missionsCount: 9, isActive: false },
  { id: 'sp_clientes', name: 'Clientes', icon: 'Users', color: 'green', missionsCount: 6, isActive: false },
];

export const MOCK_NAV_ITEMS: NavItem[] = [
  { id: 'nav_dashboard', label: 'Dashboard', href: '/dashboard', icon: 'LayoutGrid' },
  { id: 'nav_nova', label: 'Nova', href: '/nova', icon: 'Sparkles' },
  { id: 'nav_timeline', label: 'Timeline', href: '/timeline', icon: 'Activity', badge: 3 },
  { id: 'nav_missoes', label: 'Missões', href: '/missoes', icon: 'Target', badge: 5 },
  { id: 'nav_projetos', label: 'Projetos', href: '/projetos', icon: 'FolderKanban' },
  { id: 'nav_documentos', label: 'Documentos', href: '/documentos', icon: 'FileText' },
  { id: 'nav_knowledge', label: 'Knowledge', href: '/knowledge', icon: 'BookOpen' },
  { id: 'nav_financeiro', label: 'Financeiro', href: '/financeiro', icon: 'Wallet' },
];

export const MOCK_STATS: DashboardStat[] = [
  { id: 'st_missoes', label: 'Missões ativas', value: '12', delta: '+3 esta semana', trend: 'up', accent: 'purple' },
  { id: 'st_execucoes', label: 'Execuções invisíveis', value: '47', delta: '+18%', trend: 'up', accent: 'green' },
  { id: 'st_pendencias', label: 'Pendências críticas', value: '2', delta: '-1 desde ontem', trend: 'down', accent: 'red' },
  { id: 'st_receita', label: 'Receita do mês', value: 'R$ 84.200', delta: '+9,4%', trend: 'up', accent: 'blue' },
];

export const MOCK_MISSIONS: Mission[] = [
  {
    id: 'ms_001',
    title: 'Lançar produto CONTROL OS v1',
    spaceId: 'sp_empresa',
    status: 'em_andamento',
    progress: 62,
    dueDate: '2026-07-28',
    objectivesTotal: 8,
    objectivesDone: 5,
  },
  {
    id: 'ms_002',
    title: 'Fechar 3 novos clientes enterprise',
    spaceId: 'sp_clientes',
    status: 'em_risco',
    progress: 34,
    dueDate: '2026-07-20',
    objectivesTotal: 5,
    objectivesDone: 2,
  },
  {
    id: 'ms_003',
    title: 'Reorganizar rotina de saúde',
    spaceId: 'sp_vida',
    status: 'planejamento',
    progress: 10,
    objectivesTotal: 4,
    objectivesDone: 0,
  },
  {
    id: 'ms_004',
    title: 'Consolidar processo financeiro mensal',
    spaceId: 'sp_empresa',
    status: 'concluida',
    progress: 100,
    dueDate: '2026-07-05',
    objectivesTotal: 6,
    objectivesDone: 6,
  },
];

export const MOCK_TIMELINE: TimelineEvent[] = [
  {
    id: 'tl_001',
    type: 'execucao',
    title: 'Nova concluiu 4 execuções da Missão "Lançar produto CONTROL OS v1"',
    timestamp: '2026-07-11T08:12:00Z',
    spaceId: 'sp_empresa',
    actor: 'nova',
  },
  {
    id: 'tl_002',
    type: 'mensagem_nova',
    title: 'Nova sinalizou risco de prazo em "Fechar 3 novos clientes enterprise"',
    description: 'Proposta comercial parada há 4 dias sem resposta do cliente Atlas.',
    timestamp: '2026-07-11T07:40:00Z',
    spaceId: 'sp_clientes',
    actor: 'nova',
  },
  {
    id: 'tl_003',
    type: 'financeiro',
    title: 'Fatura #1042 paga automaticamente',
    timestamp: '2026-07-10T19:05:00Z',
    spaceId: 'sp_empresa',
    actor: 'sistema',
  },
  {
    id: 'tl_004',
    type: 'missao_concluida',
    title: 'Missão "Consolidar processo financeiro mensal" concluída',
    timestamp: '2026-07-10T16:30:00Z',
    spaceId: 'sp_empresa',
    actor: 'user',
  },
  {
    id: 'tl_005',
    type: 'documento',
    title: 'Documento "Contrato Atlas v2" atualizado',
    timestamp: '2026-07-10T11:15:00Z',
    spaceId: 'sp_clientes',
    actor: 'user',
  },
];

export const MOCK_NOVA_MESSAGES: [NovaMessage, ...NovaMessage[]] = [
  {
    id: 'nv_001',
    role: 'nova',
    content: 'Bom dia, Ivoli. Você tem 2 pendências críticas e 1 missão em risco de prazo. Quer que eu priorize o dia?',
    timestamp: '2026-07-11T08:00:00Z',
  },
  {
    id: 'nv_002',
    role: 'user',
    content: 'Sim, priorize.',
    timestamp: '2026-07-11T08:01:00Z',
  },
  {
    id: 'nv_003',
    role: 'nova',
    content:
      'Feito. Coloquei "Fechar 3 novos clientes enterprise" no topo — o cliente Atlas está sem resposta há 4 dias. Também agendei um lembrete às 14h para revisar o contrato.',
    timestamp: '2026-07-11T08:01:20Z',
  },
];
