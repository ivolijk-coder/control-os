/**
 * Saída do `NovaGateway.send` — deliberadamente mínima e independente de
 * `NovaTurnResult` (`services/nova/interfaces`). Ver `nova-gateway.ts`
 * para a justificativa completa dessa separação.
 */
export interface NovaGatewayResult {
  reply: string;
  /** `false` quando a NOVA (ainda mock, nesta fase) não conseguiu processar a mensagem. */
  handled: boolean;
}
