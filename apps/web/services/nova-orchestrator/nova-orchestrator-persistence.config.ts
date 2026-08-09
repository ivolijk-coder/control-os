export const NOVA_ORCHESTRATOR_PERSISTENCE = Object.freeze({
  turnLeaseMs: 120_000,
  heartbeatMs: 30_000,
  maxTurnClaims: 3,
  confirmationLeaseMs: 120_000,
  confirmationTtlMs: 15 * 60_000,
  semanticStateTtlMs: 24 * 60 * 60_000,
});
