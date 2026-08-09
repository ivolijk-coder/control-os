import { createHash } from 'node:crypto';

/** Derivação interna e determinística. clientTurnId nunca é reutilizado como chave financeira. */
export function deriveNovaOperationId(turnId: string, actionIndex: number): string {
  const normalizedTurnId = turnId.trim();
  if (!normalizedTurnId) throw new Error('turnId é obrigatório.');
  if (!Number.isInteger(actionIndex) || actionIndex < 0) throw new Error('actionIndex inválido.');
  return createHash('sha256').update(`nova-turn\u0000${normalizedTurnId}\u0000action\u0000${actionIndex}`).digest('hex');
}
