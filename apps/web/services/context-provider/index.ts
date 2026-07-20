/**
 * Ponto único de importação do Context Provider (CONTROL HUB — Fase 2).
 * `services/control-hub` (Context Manager) e qualquer implementação futura
 * de `NovaGateway` importam só daqui — nunca de `context-provider.service.ts`
 * ou `mock-context-providers.ts` diretamente. Mesma convenção de
 * `services/control-hub/index.ts`, `services/nova/index.ts` e
 * `services/ai/index.ts`.
 */
export { ContextProviderService, contextProvider } from './context-provider.service';
export {
  agendaContextProvider,
  assetsContextProvider,
  conversationsContextProvider,
  documentsContextProvider,
  financeContextProvider,
  goalsContextProvider,
  habitsContextProvider,
  notesContextProvider,
  userProfileProvider,
} from './mock-context-providers';
export type {
  AgendaContextProvider,
  AssetsContextProvider,
  ConversationsContextProvider,
  ContextProvider,
  DocumentsContextProvider,
  FinanceContextProvider,
  GoalsContextProvider,
  HabitsContextProvider,
  ModuleContextProvider,
  NotesContextProvider,
  UserProfileProvider,
} from './context-provider.interfaces';
export type {
  AgendaContext,
  AssetsContext,
  ConversationContext,
  DocumentsContext,
  FinanceContext,
  GoalsContext,
  HabitsContext,
  NotesContext,
  UserContext,
  UserProfile,
} from './user-context.types';
