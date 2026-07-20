import {
  agendaContextProvider as defaultAgendaContextProvider,
  assetsContextProvider as defaultAssetsContextProvider,
  conversationsContextProvider as defaultConversationsContextProvider,
  documentsContextProvider as defaultDocumentsContextProvider,
  financeContextProvider as defaultFinanceContextProvider,
  goalsContextProvider as defaultGoalsContextProvider,
  habitsContextProvider as defaultHabitsContextProvider,
  notesContextProvider as defaultNotesContextProvider,
  userProfileProvider as defaultUserProfileProvider,
} from './mock-context-providers';
import type {
  AgendaContextProvider,
  AssetsContextProvider,
  ConversationsContextProvider,
  ContextProvider,
  DocumentsContextProvider,
  FinanceContextProvider,
  GoalsContextProvider,
  HabitsContextProvider,
  NotesContextProvider,
  UserProfileProvider,
} from './context-provider.interfaces';
import type { UserContext } from './user-context.types';

/**
 * ContextProviderService — "o Context Provider será a única camada
 * autorizada a montar contexto... conversa com todos os módulos... Cada
 * módulo fornece apenas seus próprios dados. O Context Provider monta
 * tudo." `getUserContext` chama os 9 providers de módulo em paralelo
 * (`Promise.all` — nenhum depende do resultado de outro) e monta o
 * `UserContext` final.
 *
 * "NÃO utilizar Zustand. NÃO utilizar useDataStore. NÃO importar hooks.
 * NÃO importar componentes. NÃO depender do frontend." — nenhum import
 * deste arquivo (nem transitivamente, via `mock-context-providers.ts` ou
 * `user-context.types.ts`) vem de `react`, `zustand`, `next/*` ou de
 * `apps/web/lib`/`apps/web/components`. Roda igual num Route Handler,
 * num worker Node standalone ou (se um dia existir) num teste automatizado
 * puro, sem nenhum ambiente de navegador.
 *
 * Injeção via construtor com defaults (mesmo padrão de
 * `ControlHubService`) — "utilizar injeção de dependências seguindo o
 * padrão já utilizado no projeto": trocar qualquer provider mock por uma
 * implementação real (Postgres, Redis, API, cache) é passar outra
 * implementação aqui, nenhuma outra linha do CONTROL HUB muda.
 */
export class ContextProviderService implements ContextProvider {
  constructor(
    private readonly profile: UserProfileProvider = defaultUserProfileProvider,
    private readonly agenda: AgendaContextProvider = defaultAgendaContextProvider,
    private readonly finance: FinanceContextProvider = defaultFinanceContextProvider,
    private readonly goals: GoalsContextProvider = defaultGoalsContextProvider,
    private readonly habits: HabitsContextProvider = defaultHabitsContextProvider,
    private readonly assets: AssetsContextProvider = defaultAssetsContextProvider,
    private readonly notes: NotesContextProvider = defaultNotesContextProvider,
    private readonly documents: DocumentsContextProvider = defaultDocumentsContextProvider,
    private readonly conversations: ConversationsContextProvider = defaultConversationsContextProvider
  ) {}

  async getUserContext(userId: string): Promise<UserContext> {
    const [profile, agenda, finance, goals, habits, assets, notes, documents, recentConversations] = await Promise.all([
      this.profile.getProfile(userId),
      this.agenda.getContext(userId),
      this.finance.getContext(userId),
      this.goals.getContext(userId),
      this.habits.getContext(userId),
      this.assets.getContext(userId),
      this.notes.getContext(userId),
      this.documents.getContext(userId),
      this.conversations.getContext(userId),
    ]);

    return { profile, agenda, finance, goals, habits, assets, notes, documents, recentConversations };
  }
}

export const contextProvider: ContextProvider = new ContextProviderService();
