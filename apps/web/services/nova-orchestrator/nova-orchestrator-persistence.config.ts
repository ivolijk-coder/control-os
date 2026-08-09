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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

type NovaRolloutEnvironment = {
  readonly NOVA_SERVER_ORCHESTRATOR_ENABLED?: string;
  readonly NOVA_SERVER_ORCHESTRATOR_WEB_USER_ALLOWLIST?: string;
};

/**
 * Allowlist estritamente server-side. Um item inválido invalida a lista
 * inteira para que erro de configuração nunca amplie o piloto.
 */
export function parseNovaServerOrchestratorWebUserAllowlist(value: string | undefined): ReadonlySet<string> {
  if (!value?.trim()) return new Set();
  const items = value.split(',').map((item) => item.trim().toLowerCase());
  if (items.some((item) => !UUID_PATTERN.test(item))) return new Set();
  return new Set(items);
}

export function isNovaServerOrchestratorEnabledFor(
  input: { readonly userId: string; readonly channel: 'WEB' | 'APP' | 'WHATSAPP' | 'API' },
  environment: NovaRolloutEnvironment | NodeJS.ProcessEnv = process.env
): boolean {
  if (!isNovaServerOrchestratorEnabled(environment) || input.channel !== 'WEB') return false;
  const allowlist = parseNovaServerOrchestratorWebUserAllowlist(
    environment.NOVA_SERVER_ORCHESTRATOR_WEB_USER_ALLOWLIST
  );
  return allowlist.has(input.userId.trim().toLowerCase());
}
