import type { NovaReferenceSelection } from './nova-orchestrator.types';

const FINANCIAL_FACT_KEY = /(?:amount|balance|saldo|valor|total|debt|divida|limit|limite|installmentValue|overdue)/iu;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateNovaReferenceSelection(value: unknown): NovaReferenceSelection | null {
  if (value === null) return null;
  if (!record(value) || Object.keys(value).some((key) => FINANCIAL_FACT_KEY.test(key))) throw new Error('Referência semântica inválida.');
  if (value.kind === 'ENTITY' && typeof value.entityId === 'string' && value.entityId.trim() && typeof value.entityType === 'string' && value.entityType.trim() && Object.keys(value).every((key) => ['kind', 'entityId', 'entityType'].includes(key))) {
    return { kind: 'ENTITY', entityId: value.entityId.trim(), entityType: value.entityType.trim() };
  }
  if (value.kind === 'SET' && typeof value.setReference === 'string' && value.setReference.trim() && typeof value.entityType === 'string' && value.entityType.trim() && Object.keys(value).every((key) => ['kind', 'setReference', 'entityType'].includes(key))) {
    return { kind: 'SET', setReference: value.setReference.trim(), entityType: value.entityType.trim() };
  }
  if (value.kind === 'RELATIVE' && ['OTHER', 'PREVIOUS', 'NEXT', 'ORDINAL'].includes(String(value.relation)) && Object.keys(value).every((key) => ['kind', 'relation', 'ordinal'].includes(key))) {
    const ordinal = value.ordinal;
    if (value.relation === 'ORDINAL' && (!Number.isInteger(ordinal) || Number(ordinal) < 1)) throw new Error('Referência ordinal inválida.');
    if (value.relation !== 'ORDINAL' && ordinal !== undefined) throw new Error('Ordinal não permitido nesta referência.');
    return { kind: 'RELATIVE', relation: value.relation as 'OTHER' | 'PREVIOUS' | 'NEXT' | 'ORDINAL', ...(ordinal === undefined ? {} : { ordinal: Number(ordinal) }) };
  }
  throw new Error('Referência semântica inválida.');
}
