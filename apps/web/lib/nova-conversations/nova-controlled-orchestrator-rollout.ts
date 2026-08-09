import {
  NovaConversationApiError,
  type NovaOrchestratorResultDto,
  type ProcessNovaMessageRequest,
} from './nova-conversation-api-client';

export type ControlledOrchestratorRoute =
  | { kind: 'LEGACY' }
  | { kind: 'ORCHESTRATOR'; result: NovaOrchestratorResultDto };

/** Somente a negativa explícita do servidor autoriza o pipeline legado. */
export async function routeControlledOrchestratorTurn(
  processMessage: (input: ProcessNovaMessageRequest) => Promise<NovaOrchestratorResultDto>,
  input: ProcessNovaMessageRequest
): Promise<ControlledOrchestratorRoute> {
  try {
    return { kind: 'ORCHESTRATOR', result: await processMessage(input) };
  } catch (cause) {
    if (cause instanceof NovaConversationApiError && cause.code === 'ORCHESTRATOR_DISABLED') {
      return { kind: 'LEGACY' };
    }
    throw cause;
  }
}
