/**
 * Narrowing seguro de `ActionRequest.payload` (`Record<string, unknown>`)
 * campo a campo — SEM `any`, SEM `as X` (regra do projeto: nenhum cast de
 * tipo em lugar nenhum). Cada Action usa estas funções em vez de reescrever
 * o mesmo `typeof value === 'string' ? value : undefined` várias vezes —
 * "evitar duplicação" aplicado a validação de payload, não só a lógica de
 * domínio.
 */

export function getString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
}

export function getNumber(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function getBoolean(payload: Record<string, unknown>, key: string): boolean | undefined {
  const value = payload[key];
  return typeof value === 'boolean' ? value : undefined;
}
