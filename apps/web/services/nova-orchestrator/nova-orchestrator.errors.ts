export type NovaOrchestratorErrorCode =
  | 'INVALID_TURN_IDENTITY'
  | 'INVALID_TURN_TRANSITION'
  | 'INVALID_LEASE'
  | 'TURN_NOT_FOUND'
  | 'TURN_NOT_ACCESSIBLE'
  | 'TURN_ALREADY_PROCESSING'
  | 'CONFIRMATION_NOT_AVAILABLE'
  | 'CONFIRMATION_EXPIRED'
  | 'INTERNAL_FAILURE';

/** Erro de domínio sem detalhes de infraestrutura ou de providers externos. */
export class NovaOrchestratorError extends Error {
  constructor(
    readonly code: NovaOrchestratorErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'NovaOrchestratorError';
  }
}
