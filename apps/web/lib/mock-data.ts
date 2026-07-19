import type {
  AgendaEvent,
  Asset,
  DashboardStat,
  Debt,
  FinanceEntry,
  Habit,
  Mission,
  NavItem,
  NovaMessage,
  Note,
  PersonalDocument,
  TimelineEvent,
  Trip,
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

/**
 * Navegação da Sidebar (CONTROL OS — "Pessoa Física": eliminação completa do
 * conceito de Control Spaces™).
 *
 * Até aqui a Sidebar tinha um seletor de Spaces ("Minha Vida" / "Minha
 * Empresa" / "Clientes", cada um com contador de missões) acima de dois
 * grupos de navegação separados ("Minha Vida" em destaque, "Empresa" em
 * segundo plano). Pedido explícito do usuário: "o CONTROL OS será focado em
 * Pessoa Física... o usuário não deve precisar escolher um Space. Ao abrir o
 * CONTROL OS ele já está dentro da sua vida." Não existe mais escolha de
 * contexto nem divisão em grupos — uma lista única e plana, a navegação
 * principal já começa direto no topo da Sidebar.
 *
 * `nav_missoes` e `nav_timeline` saíram desta lista (não fazem parte da
 * estrutura final pedida pelo usuário) — as páginas `/missoes` e `/timeline`
 * continuam existindo e acessíveis por URL direta, só perderam o item fixo
 * no menu. `nav_nova`/`nav_legendary` entraram como itens de navegação
 * regulares para as rotas fixas das duas inteligências (`/nova`, `/legendary`
 * — ver `nova-floating-launcher.tsx`, mesmo destino, só que agora também
 * alcançável pela Sidebar). `nav_configuracoes` é novo (`/configuracoes`,
 * página mínima criada junto com esta mudança) — sem ele o item ficaria
 * apontando para um link morto, o que este arquivo historicamente evita.
 */
export const MOCK_NAV_ITEMS: NavItem[] = [
  { id: 'nav_visao_geral', label: 'Visão geral', href: '/dashboard', icon: 'LayoutGrid' },
  { id: 'nav_financeiro', label: 'Financeiro', href: '/financeiro', icon: 'Wallet' },
  { id: 'nav_agenda', label: 'Agenda', href: '/agenda', icon: 'CalendarClock' },
  { id: 'nav_metas', label: 'Metas', href: '/metas', icon: 'Trophy' },
  { id: 'nav_habitos', label: 'Hábitos', href: '/habitos', icon: 'Repeat' },
  { id: 'nav_documentos', label: 'Documentos', href: '/documentos', icon: 'FileText' },
  { id: 'nav_patrimonio', label: 'Patrimônio', href: '/patrimonio', icon: 'Landmark' },
  { id: 'nav_viagens', label: 'Viagens', href: '/viagens', icon: 'Plane' },
  { id: 'nav_notas', label: 'Notas', href: '/notas', icon: 'NotebookText' },
  { id: 'nav_nova', label: 'NOVA', href: '/nova', icon: 'Sparkles' },
  { id: 'nav_legendary', label: 'LEGENDARY', href: '/legendary', icon: 'BookOpen' },
  { id: 'nav_configuracoes', label: 'Configurações', href: '/configuracoes', icon: 'Settings' },
];

export const MOCK_STATS: DashboardStat[] = [
  { id: 'st_missoes', label: 'Missões ativas', value: '12', delta: '+3 esta semana', trend: 'up', accent: 'purple' },
  { id: 'st_execucoes', label: 'Execuções invisíveis', value: '47', delta: '+18%', trend: 'up', accent: 'green' },
  { id: 'st_pendencias', label: 'Pendências críticas', value: '2', delta: '-1 desde ontem', trend: 'down', accent: 'red' },
  { id: 'st_receita', label: 'Receita do mês', value: 'R$ 84.200', delta: '+9,4%', trend: 'up', accent: 'blue' },
];

/**
 * Painel inteligente (Nova Experience — Fase 2) — resumo "Hoje" revelado
 * após a primeira interação com a NOVA no `NovaWorkspace`. Reaproveita o
 * tipo `DashboardStat` (mesmo formato dos cartões do topo da Home) em vez
 * de criar um tipo novo só para isso.
 */
export const MOCK_PAINEL_HOJE: DashboardStat[] = [
  { id: 'painel_receita', label: 'Receita prevista', value: 'R$ 92.400', delta: '+8% vs. mês passado', trend: 'up', accent: 'blue' },
  { id: 'painel_gastos', label: 'Gastos', value: 'R$ 31.150', delta: '-4% vs. mês passado', trend: 'down', accent: 'red' },
  { id: 'painel_clientes', label: 'Clientes', value: '18 ativos', delta: '+2 esta semana', trend: 'up', accent: 'green' },
  { id: 'painel_projetos', label: 'Projetos', value: '6 em andamento', accent: 'purple' },
  { id: 'painel_missoes', label: 'Missões', value: '12 ativas', accent: 'purple' },
  { id: 'painel_agenda', label: 'Agenda', value: '3 compromissos hoje', accent: 'blue' },
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
    kind: 'projeto',
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
    kind: 'meta',
  },
  {
    id: 'ms_003',
    title: 'Reorganizar rotina de saúde',
    spaceId: 'sp_vida',
    status: 'planejamento',
    progress: 10,
    objectivesTotal: 4,
    objectivesDone: 0,
    kind: 'meta',
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
    kind: 'projeto',
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

/**
 * Seed inicial do `useDataStore` (CONTROL OS 3.0). A partir daqui esses
 * dados passam a viver no store reativo — este array só define o estado
 * inicial na primeira carga (equivalente ao que `MOCK_MISSIONS` já fazia
 * para o Dashboard antes do 3.0).
 */
export const MOCK_FINANCE_ENTRIES: FinanceEntry[] = [
  {
    id: 'fn_001',
    type: 'receita',
    description: 'Pagamento cliente Atlas — parcela 2/3',
    amount: 18500,
    category: 'Serviços',
    date: '2026-07-10T14:00:00Z',
    spaceId: 'sp_empresa',
  },
  {
    id: 'fn_002',
    type: 'despesa',
    description: 'Assinatura ferramentas de design',
    amount: 349,
    category: 'Software',
    date: '2026-07-09T09:30:00Z',
    spaceId: 'sp_empresa',
  },
  {
    id: 'fn_003',
    type: 'despesa',
    description: 'Almoço com equipe comercial',
    amount: 186,
    category: 'Alimentação',
    date: '2026-07-08T12:20:00Z',
    spaceId: 'sp_empresa',
  },
];

/**
 * Dívidas (CONTROL OS — Etapa 3, Financeiro avançado). `remainingAmount`
 * já reflete `installmentsPaid` — não precisa ser recalculado na leitura.
 */
export const MOCK_DEBTS: Debt[] = [
  {
    id: 'db_001',
    description: 'Financiamento do carro',
    totalAmount: 48000,
    remainingAmount: 33000,
    installmentsTotal: 48,
    installmentsPaid: 15,
    category: 'Veículo',
    spaceId: 'sp_vida',
  },
  {
    id: 'db_002',
    description: 'Cartão de crédito — notebook parcelado',
    totalAmount: 4800,
    remainingAmount: 2400,
    installmentsTotal: 10,
    installmentsPaid: 5,
    category: 'Cartão',
    spaceId: 'sp_empresa',
  },
];

/** Hábitos (CONTROL OS — Sistema Operacional Pessoal). */
export const MOCK_HABITS: Habit[] = [
  {
    id: 'hb_001',
    title: 'Beber água',
    category: 'Saúde',
    streakDays: 6,
    completedToday: true,
    last7Days: [true, true, false, true, true, true, true],
    spaceId: 'sp_vida',
  },
  {
    id: 'hb_002',
    title: 'Dormir 8h',
    category: 'Sono',
    streakDays: 2,
    completedToday: false,
    last7Days: [false, true, true, false, true, true, false],
    spaceId: 'sp_vida',
  },
  {
    id: 'hb_003',
    title: 'Academia',
    category: 'Academia',
    streakDays: 4,
    completedToday: true,
    last7Days: [false, true, true, true, true, false, true],
    spaceId: 'sp_vida',
  },
  {
    id: 'hb_004',
    title: 'Ler 20 páginas',
    category: 'Leitura',
    streakDays: 0,
    completedToday: false,
    last7Days: [true, true, false, false, false, false, false],
    spaceId: 'sp_vida',
  },
  {
    id: 'hb_005',
    title: 'Meditar',
    category: 'Meditação',
    streakDays: 9,
    completedToday: true,
    last7Days: [true, true, true, true, true, true, true],
    spaceId: 'sp_vida',
  },
];

/** Documentos pessoais (CONTROL OS — Sistema Operacional Pessoal). */
export const MOCK_DOCUMENTS: PersonalDocument[] = [
  { id: 'doc_001', title: 'CNH', category: 'Identificação', addedAt: '2024-03-10', expiresAt: '2029-03-10', spaceId: 'sp_vida' },
  { id: 'doc_002', title: 'RG', category: 'Identificação', addedAt: '2022-01-15', spaceId: 'sp_vida' },
  { id: 'doc_003', title: 'Passaporte', category: 'Identificação', addedAt: '2023-06-01', expiresAt: '2033-06-01', spaceId: 'sp_vida' },
  { id: 'doc_004', title: 'Garantia — Notebook Dell', category: 'Garantia', addedAt: '2025-11-20', expiresAt: '2026-11-20', spaceId: 'sp_vida' },
  { id: 'doc_005', title: 'Contrato de aluguel', category: 'Contrato', addedAt: '2025-08-01', spaceId: 'sp_vida' },
];

/** Patrimônio (CONTROL OS — Sistema Operacional Pessoal). */
export const MOCK_ASSETS: Asset[] = [
  { id: 'as_001', name: 'Honda Civic 2022', category: 'Carro', estimatedValue: 135000, purchaseDate: '2022-05-10', spaceId: 'sp_vida' },
  { id: 'as_002', name: 'Apartamento — Zona Sul', category: 'Casa', estimatedValue: 620000, purchaseDate: '2021-02-01', spaceId: 'sp_vida' },
  { id: 'as_003', name: 'MacBook Pro 14"', category: 'Computador', estimatedValue: 18000, purchaseDate: '2025-11-20', warrantyUntil: '2026-11-20', spaceId: 'sp_vida' },
  { id: 'as_004', name: 'iPhone 16 Pro', category: 'Celular', estimatedValue: 8500, purchaseDate: '2025-09-15', warrantyUntil: '2026-09-15', spaceId: 'sp_vida' },
];

/** Viagens (CONTROL OS — Sistema Operacional Pessoal). */
export const MOCK_TRIPS: Trip[] = [
  {
    id: 'tr_001',
    destination: 'Lisboa, Portugal',
    startDate: '2026-09-10',
    endDate: '2026-09-20',
    budget: 15000,
    spaceId: 'sp_vida',
    checklist: [
      { id: 'tr_001_1', label: 'Comprar passagem', done: true },
      { id: 'tr_001_2', label: 'Reservar hotel', done: true },
      { id: 'tr_001_3', label: 'Verificar validade do passaporte', done: false },
      { id: 'tr_001_4', label: 'Contratar seguro viagem', done: false },
    ],
  },
];

/** Notas (CONTROL OS — Sistema Operacional Pessoal). */
export const MOCK_NOTES: Note[] = [
  {
    id: 'nt_001',
    title: 'Ideias para o aniversário da Ana',
    type: 'texto',
    category: 'Pessoal',
    createdAt: '2026-07-08T10:00:00Z',
    content: 'Reservar restaurante, chamar os amigos próximos, comprar o presente que ela comentou.',
    spaceId: 'sp_vida',
  },
  {
    id: 'nt_002',
    title: 'Compras do mês',
    type: 'checklist',
    category: 'Casa',
    createdAt: '2026-07-10T09:00:00Z',
    spaceId: 'sp_vida',
    checklistItems: [
      { id: 'nt_002_1', label: 'Filtro de água', done: false },
      { id: 'nt_002_2', label: 'Lâmpadas', done: true },
      { id: 'nt_002_3', label: 'Pilhas', done: false },
    ],
  },
];

export const MOCK_AGENDA_EVENTS: AgendaEvent[] = [
  {
    id: 'ag_001',
    title: 'Reunião de alinhamento — cliente Atlas',
    date: '2026-07-12',
    time: '15:00',
    spaceId: 'sp_clientes',
  },
  {
    id: 'ag_002',
    title: 'Revisão financeira mensal',
    date: '2026-07-13',
    time: '10:00',
    spaceId: 'sp_empresa',
  },
  {
    id: 'ag_003',
    title: 'Vencimento do DAS',
    date: '2026-07-16',
    spaceId: 'sp_empresa',
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
