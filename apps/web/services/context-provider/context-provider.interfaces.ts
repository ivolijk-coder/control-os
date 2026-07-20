import type {
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

/**
 * Contratos do Context Provider (CONTROL HUB — Fase 2).
 *
 * "Dependency Inversion: todos os módulos deverão depender de interfaces,
 * não de implementações concretas." `ContextProviderService`
 * (`context-provider.service.ts`) depende só destas interfaces — trocar
 * `mock-context-providers.ts` por implementações reais (banco de dados,
 * cache, API) é passar outras implementações no construtor, nenhuma linha
 * de `ContextProviderService` muda. Mesmo padrão já usado em
 * `services/control-hub/control-hub.service.ts`.
 */

/**
 * Forma comum a todo provider de módulo — um método, `getContext`, que
 * devolve o recorte daquele módulo para um usuário. Os oito providers
 * abaixo (`AgendaContextProvider`, `FinanceContextProvider`...) são cada
 * um sua própria interface nomeada, como pedido explicitamente — só
 * reaproveitam esta forma genérica para não repetir a mesma assinatura de
 * método oito vezes.
 */
export interface ModuleContextProvider<TContext> {
  getContext(userId: string): Promise<TContext>;
}

export type AgendaContextProvider = ModuleContextProvider<AgendaContext>;
export type FinanceContextProvider = ModuleContextProvider<FinanceContext>;
export type GoalsContextProvider = ModuleContextProvider<GoalsContext>;
export type HabitsContextProvider = ModuleContextProvider<HabitsContext>;
export type AssetsContextProvider = ModuleContextProvider<AssetsContext>;
export type NotesContextProvider = ModuleContextProvider<NotesContext>;
export type DocumentsContextProvider = ModuleContextProvider<DocumentsContext>;
/** Não listado explicitamente no pedido original, mas necessário: `UserContext.recentConversations` precisa de uma fonte, pelo mesmo padrão dos outros sete módulos. */
export type ConversationsContextProvider = ModuleContextProvider<ConversationContext[]>;

/** `profile` tem forma própria (um objeto, não uma lista) — método com nome próprio em vez de reaproveitar `ModuleContextProvider`. */
export interface UserProfileProvider {
  getProfile(userId: string): Promise<UserProfile>;
}

/**
 * Orquestrador — "o Context Provider será a única camada autorizada a
 * montar contexto. Ele deverá conversar com todos os módulos... Cada
 * módulo fornece apenas seus próprios dados. O Context Provider monta
 * tudo." `getUserContext` é o único método público; nada fora deste
 * módulo deve chamar um `XContextProvider` individual diretamente.
 */
export interface ContextProvider {
  getUserContext(userId: string): Promise<UserContext>;
}
