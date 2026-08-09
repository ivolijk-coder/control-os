import { describe, expect, it, vi } from 'vitest';
import {
  NovaConversationApiError,
  type NovaOrchestratorResultDto,
} from '@/lib/nova-conversations/nova-conversation-api-client';
import { routeControlledOrchestratorTurn } from '@/lib/nova-conversations/nova-controlled-orchestrator-rollout';

const input = { clientTurnId: 'same-client-turn', content: 'Tenho conta atrasada?' };
const completed: NovaOrchestratorResultDto = {
  status: 'COMPLETED', turnId: 'turn', messages: [],
};

describe('rollout controlado do Orchestrator', () => {
  it('autoriza legado somente com ORCHESTRATOR_DISABLED estruturado', async () => {
    const process = vi.fn().mockRejectedValue(new NovaConversationApiError(
      'Indisponível.', 503, 'ORCHESTRATOR_DISABLED'
    ));
    await expect(routeControlledOrchestratorTurn(process, input)).resolves.toEqual({ kind: 'LEGACY' });
  });

  it.each([
    completed,
    { status: 'PROCESSING', turnId: 'turn' } as const,
    { status: 'FAILED', turnId: 'turn', error: { code: 'SOURCE_UNAVAILABLE', message: 'Falhou.' } } as const,
  ])('mantém COMPLETED/PROCESSING/FAILED exclusivamente no Orchestrator', async (result) => {
    const process = vi.fn().mockResolvedValue(result);
    await expect(routeControlledOrchestratorTurn(process, input)).resolves.toEqual({
      kind: 'ORCHESTRATOR', result,
    });
  });

  it.each([
    new NovaConversationApiError('Erro interno.', 500),
    new NovaConversationApiError('Timeout.', 0),
    new TypeError('Conexão interrompida'),
  ])('não autoriza fallback para falha ambígua: %s', async (cause) => {
    const process = vi.fn().mockRejectedValue(cause);
    await expect(routeControlledOrchestratorTurn(process, input)).rejects.toBe(cause);
  });

  it('retry reutiliza exatamente o mesmo clientTurnId sem executar outro pipeline', async () => {
    const process = vi.fn().mockResolvedValue(completed);
    await routeControlledOrchestratorTurn(process, input);
    await routeControlledOrchestratorTurn(process, input);
    expect(process).toHaveBeenCalledTimes(2);
    expect(process.mock.calls[0]?.[0]).toEqual(process.mock.calls[1]?.[0]);
  });
});
