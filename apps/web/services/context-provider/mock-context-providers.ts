import type {
  AgendaContextProvider,
  AssetsContextProvider,
  ConversationsContextProvider,
  DocumentsContextProvider,
  FinanceContextProvider,
  GoalsContextProvider,
  HabitsContextProvider,
  ModuleContextProvider,
  NotesContextProvider,
  UserProfileProvider,
} from './context-provider.interfaces';
import type {
  AgendaContext,
  AssetsContext,
  ConversationContext,
  DocumentsContext,
  FinanceContext,
  GoalsContext,
  HabitsContext,
  NotesContext,
  UserProfile,
} from './user-context.types';

/**
 * Implementações mock dos providers de módulo (CONTROL HUB — Fase 2).
 * "Nesta etapa utilizar mocks. Não conectar banco de dados ainda."
 *
 * Dados fixture pequenos e PRÓPRIOS deste arquivo — deliberadamente NÃO
 * reaproveitam `apps/web/lib/mock-data.ts` (que já tem dados mockados
 * maiores para a UI). Dois motivos: (1) manter este módulo sem nenhum
 * import de `apps/web/lib` — é o que garante que `services/context-
 * provider` continue portável para um pacote compartilhado no futuro
 * (ver `user-context.types.ts` e o relatório desta fase); (2) os dois
 * conjuntos de mock têm propósitos diferentes — `lib/mock-data.ts`
 * alimenta a navegação manual da UI, este arquivo só prova que o pipeline
 * do CONTROL HUB monta um `UserContext` de ponta a ponta.
 *
 * `createMockModuleProvider` é uma fábrica genérica (em vez de 8 classes
 * quase idênticas) — cada provider real, no futuro, vira sua própria
 * implementação dedicada (banco de dados, cache, API); a fábrica só serve
 * para esta fase de fundação.
 */
function createMockModuleProvider<TContext>(mockValue: TContext): ModuleContextProvider<TContext> {
  return {
    async getContext(_userId: string): Promise<TContext> {
      return mockValue;
    },
  };
}

const MOCK_AGENDA: AgendaContext = [
  { id: 'agenda_mock_1', title: 'Reunião de alinhamento semanal', date: new Date().toISOString().slice(0, 10), time: '10:00' },
];

const MOCK_FINANCE: FinanceContext = [
  { id: 'finance_mock_1', type: 'despesa', description: 'Assinatura de software', amount: 89.9, category: 'ferramentas', date: new Date().toISOString().slice(0, 10) },
];

const MOCK_GOALS: GoalsContext = [
  { id: 'goal_mock_1', title: 'Organizar a semana', spaceId: 'sp_vida', status: 'em_andamento', progress: 40, objectivesTotal: 5, objectivesDone: 2, kind: 'meta' },
];

const MOCK_HABITS: HabitsContext = [
  { id: 'habit_mock_1', title: 'Beber água', category: 'saúde', streakDays: 3, completedToday: false, last7Days: [true, true, false, true, true, true, false] },
];

const MOCK_ASSETS: AssetsContext = [
  { id: 'asset_mock_1', name: 'Notebook de trabalho', category: 'eletrônicos', estimatedValue: 8000 },
];

const MOCK_NOTES: NotesContext = [
  { id: 'note_mock_1', title: 'Ideias para o próximo lançamento', type: 'texto', category: 'trabalho', createdAt: new Date().toISOString(), content: 'Rascunho inicial.' },
];

const MOCK_DOCUMENTS: DocumentsContext = [
  { id: 'document_mock_1', title: 'Contrato de prestação de serviço', category: 'contratos', addedAt: new Date().toISOString() },
];

const MOCK_CONVERSATIONS: ConversationContext[] = [];

const MOCK_PROFILE: UserProfile = { id: 'usr_mock', name: 'Usuário' };

export const agendaContextProvider: AgendaContextProvider = createMockModuleProvider(MOCK_AGENDA);
export const financeContextProvider: FinanceContextProvider = createMockModuleProvider(MOCK_FINANCE);
export const goalsContextProvider: GoalsContextProvider = createMockModuleProvider(MOCK_GOALS);
export const habitsContextProvider: HabitsContextProvider = createMockModuleProvider(MOCK_HABITS);
export const assetsContextProvider: AssetsContextProvider = createMockModuleProvider(MOCK_ASSETS);
export const notesContextProvider: NotesContextProvider = createMockModuleProvider(MOCK_NOTES);
export const documentsContextProvider: DocumentsContextProvider = createMockModuleProvider(MOCK_DOCUMENTS);
/** Vazio, não com fixture — "conversas recentes" mockadas com conteúdo inventado seria mais confuso que útil; um histórico vazio já é um `UserContext` válido. */
export const conversationsContextProvider: ConversationsContextProvider = createMockModuleProvider(MOCK_CONVERSATIONS);

/**
 * `userId` é ecoado de volta como `profile.id` — mesmo que o resto do
 * perfil seja fixo nesta fase, a identidade de quem pediu o contexto
 * nunca se perde na resposta mock.
 */
export const userProfileProvider: UserProfileProvider = {
  async getProfile(userId: string): Promise<UserProfile> {
    return { ...MOCK_PROFILE, id: userId };
  },
};
