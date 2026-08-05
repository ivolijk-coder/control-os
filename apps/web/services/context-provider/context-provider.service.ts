import {
  documentsContextProvider,
  operationalTasksContextProvider,
  userProfileProvider,
} from './real-context-providers';
import type { ContextProvider, ContextProviderDependencies } from './context-provider.interfaces';
import { buildUserContextCoverage, type UserContext } from './user-context.types';

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export class ContextProviderService implements ContextProvider {
  constructor(
    private readonly dependencies: ContextProviderDependencies = {
      profile: userProfileProvider,
      documents: documentsContextProvider,
      operationalTasks: operationalTasksContextProvider,
    },
    private readonly now: () => Date = () => new Date(),
    private readonly timezone: string = DEFAULT_TIMEZONE
  ) {}

  async getUserContext(userId: string): Promise<UserContext> {
    if (!userId.trim()) throw new TypeError('userId é obrigatório.');

    const [profileResult, documentsResult, tasksResult] = await Promise.allSettled([
      this.dependencies.profile.getProfile(userId),
      this.dependencies.documents.getDocumentsContext(userId),
      this.dependencies.operationalTasks.getOperationalTasksContext(userId),
    ]);
    const now = this.now();

    return {
      profile: profileResult.status === 'fulfilled' ? profileResult.value : null,
      documents: documentsResult.status === 'fulfilled' ? documentsResult.value : null,
      operationalTasks: tasksResult.status === 'fulfilled' ? tasksResult.value : null,
      runtime: {
        referenceDate: new Intl.DateTimeFormat('en-CA', { timeZone: this.timezone }).format(now),
        generatedAt: now.toISOString(),
        timezone: this.timezone,
      },
      coverage: buildUserContextCoverage({
        PROFILE: profileResult.status === 'fulfilled' && profileResult.value ? 'AVAILABLE' : 'UNAVAILABLE',
        FINANCE: 'AVAILABLE',
        DOCUMENTS: documentsResult.status === 'fulfilled' ? 'AVAILABLE' : 'UNAVAILABLE',
        OPERATIONAL_TASKS: tasksResult.status === 'fulfilled' ? 'AVAILABLE' : 'UNAVAILABLE',
      }),
    };
  }
}

export const contextProvider: ContextProvider = new ContextProviderService();
