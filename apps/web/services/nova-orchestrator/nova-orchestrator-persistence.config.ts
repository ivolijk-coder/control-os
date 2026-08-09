export const NOVA_ORCHESTRATOR_PERSISTENCE = Object.freeze({
  turnLeaseMs: 120_000,
  heartbeatMs: 30_000,
  maxTurnClaims: 3,
  confirmationLeaseMs: 120_000,
  confirmationTtlMs: 15 * 60_000,
  semanticStateTtlMs: 24 * 60 * 60_000,
});

/** Flag server-only e estrita: qualquer valor diferente de `true` mantém o fluxo inativo. */
export function isNovaServerOrchestratorEnabled(
  environment: { readonly NOVA_SERVER_ORCHESTRATOR_ENABLED?: string } | NodeJS.ProcessEnv = process.env
): boolean {
  return environment.NOVA_SERVER_ORCHESTRATOR_ENABLED === 'true';
}
