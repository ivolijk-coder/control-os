import type { DocumentsContext, OperationalTasksContext, UserContext, UserProfile } from './user-context.types';

export interface UserProfileProvider {
  getProfile(userId: string): Promise<UserProfile | null>;
}

export interface DocumentsContextProvider {
  getDocumentsContext(userId: string): Promise<DocumentsContext>;
}

export interface OperationalTasksContextProvider {
  getOperationalTasksContext(userId: string): Promise<OperationalTasksContext>;
}

export interface ContextProvider {
  getUserContext(userId: string): Promise<UserContext>;
}

export interface ContextProviderDependencies {
  profile: UserProfileProvider;
  documents: DocumentsContextProvider;
  operationalTasks: OperationalTasksContextProvider;
}
