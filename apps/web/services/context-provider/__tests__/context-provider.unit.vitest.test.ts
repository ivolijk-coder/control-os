import { describe, expect, it } from 'vitest';
import { ContextProviderService } from '../context-provider.service';

function dependencies(overrides: Partial<ConstructorParameters<typeof ContextProviderService>[0]> = {}) {
  return {
    profile: { async getProfile(userId: string) { return { id: userId, name: 'Ivoli' }; } },
    documents: { async getDocumentsContext() { return { total: 0, pendingAnalysis: 0, failedAnalysis: 0 }; } },
    operationalTasks: { async getOperationalTasksContext() { return { pending: 0, waitingUser: 0 }; } },
    ...overrides,
  };
}

describe('ContextProviderService real', () => {
  it('distingue fonte disponível sem registros de fonte não implementada', async () => {
    const service = new ContextProviderService(dependencies(), () => new Date('2026-08-05T15:00:00.000Z'));
    const context = await service.getUserContext('user-a');
    expect(context.documents).toEqual({ total: 0, pendingAnalysis: 0, failedAnalysis: 0 });
    expect(context.coverage).toContainEqual({ domain: 'DOCUMENTS', status: 'AVAILABLE' });
    expect(context.coverage).toContainEqual({ domain: 'TRIPS', status: 'NOT_IMPLEMENTED' });
  });

  it('marca somente a fonte que falhou como indisponível e não inventa fallback', async () => {
    const service = new ContextProviderService(dependencies({
      documents: { async getDocumentsContext() { throw new Error('internal'); } },
    }));
    const context = await service.getUserContext('user-a');
    expect(context.documents).toBeNull();
    expect(context.coverage).toContainEqual({ domain: 'DOCUMENTS', status: 'UNAVAILABLE' });
    expect(context.profile).toEqual({ id: 'user-a', name: 'Ivoli' });
  });

  it('isola a identidade pelo userId recebido do chamador autenticado', async () => {
    const requested: string[] = [];
    const service = new ContextProviderService(dependencies({
      profile: { async getProfile(userId) { requested.push(userId); return { id: userId, name: userId }; } },
    }));
    await service.getUserContext('user-b');
    expect(requested).toEqual(['user-b']);
  });
});
