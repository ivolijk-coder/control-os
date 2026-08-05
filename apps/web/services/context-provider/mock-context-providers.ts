import type { ContextProviderDependencies } from './context-provider.interfaces';

/** Injeção explícita para testes. Nunca é usada como default de produção. */
export function createMockContextProviderDependencies(): ContextProviderDependencies {
  return {
    profile: { async getProfile(userId) { return { id: userId, name: 'Usuário de Teste' }; } },
    documents: { async getDocumentsContext() { return { total: 0, pendingAnalysis: 0, failedAnalysis: 0 }; } },
    operationalTasks: { async getOperationalTasksContext() { return { pending: 0, waitingUser: 0 }; } },
  };
}
