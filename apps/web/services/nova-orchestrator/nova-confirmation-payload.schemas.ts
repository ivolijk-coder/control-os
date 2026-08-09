import type { ActionKind } from '@/services/control-hub';

type PrimitiveKind = 'string' | 'number' | 'boolean';
type FieldSchema = Readonly<{ kind: PrimitiveKind; optional?: boolean }>;

const optionalString = { kind: 'string', optional: true } as const;
const optionalNumber = { kind: 'number', optional: true } as const;
const requiredString = { kind: 'string' } as const;
const requiredNumber = { kind: 'number' } as const;

const ACTION_PAYLOAD_SCHEMAS: Partial<Record<ActionKind, Readonly<Record<string, FieldSchema>>>> = {
  'loan.create': { institution: optionalString, totalAmount: requiredNumber, installments: requiredNumber, installmentAmount: optionalNumber, dueDay: requiredNumber, startDate: optionalString, description: requiredString },
  'financing.create': { institution: optionalString, totalAmount: requiredNumber, installments: requiredNumber, installmentAmount: optionalNumber, dueDay: requiredNumber, startDate: optionalString, description: requiredString },
  'expense.create': { amount: requiredNumber, description: requiredString, categoryId: optionalString, accountId: optionalString, date: optionalString, status: optionalString },
  'income.create': { amount: requiredNumber, description: requiredString, categoryId: optionalString, accountId: optionalString, date: optionalString, status: optionalString },
  'transfer.create': { amount: requiredNumber, sourceAccountId: requiredString, destinationAccountId: requiredString, description: optionalString, date: optionalString },
  'installment.create': { amount: requiredNumber, installments: requiredNumber, description: requiredString, categoryId: optionalString, accountId: optionalString, date: optionalString },
  'recurring.create': { amount: requiredNumber, description: requiredString, frequency: requiredString, categoryId: optionalString, accountId: optionalString, date: optionalString },
  'account.create': { name: requiredString, kind: optionalString, initialBalance: optionalNumber },
  'category.create': { name: requiredString, kind: optionalString, icon: optionalString, color: optionalString },
  'fixed-occurrence.pay': { occurrenceId: requiredString, accountId: optionalString, paidAt: optionalString },
  'document.store': { documentId: requiredString },
};

const FORBIDDEN_KEY = /(?:user.?id|token|password|senha|secret|segredo|credential|credencial|api.?key|private.?key|bearer|authorization|session|channel|operation.?id|idempotency.?key|tool(?:payload|arguments?))/iu;
const SENSITIVE_VALUE = /(?:bearer\s+\S+|(?:api[_ -]?key|token|password|senha|secret|segredo)\s*[:=]\s*\S+|-----BEGIN[^-]*PRIVATE KEY-----)/iu;

export class NovaConfirmationPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NovaConfirmationPayloadError';
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

export function validateNovaConfirmationPayload(actionKind: ActionKind, value: unknown): Record<string, string | number | boolean> {
  const schema = ACTION_PAYLOAD_SCHEMAS[actionKind];
  if (!schema) throw new NovaConfirmationPayloadError('Action não habilitada para confirmação persistente.');
  if (!isPlainRecord(value)) throw new NovaConfirmationPayloadError('Payload de confirmação inválido.');

  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEY.test(key)) throw new NovaConfirmationPayloadError('Payload contém identidade ou conteúdo sensível.');
    if (!(key in schema)) throw new NovaConfirmationPayloadError(`Campo não permitido para ${actionKind}.`);
  }

  const result: Record<string, string | number | boolean> = {};
  for (const [key, field] of Object.entries(schema)) {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) {
      if (!field.optional) throw new NovaConfirmationPayloadError(`Campo obrigatório ausente: ${key}.`);
      continue;
    }
    if (typeof candidate !== field.kind || (typeof candidate === 'number' && !Number.isFinite(candidate)) || (typeof candidate === 'string' && !candidate.trim())) {
      throw new NovaConfirmationPayloadError(`Campo inválido: ${key}.`);
    }
    if (typeof candidate === 'string') {
      const normalized = candidate.trim();
      if (SENSITIVE_VALUE.test(normalized)) throw new NovaConfirmationPayloadError(`Conteúdo sensível não permitido: ${key}.`);
      result[key] = normalized;
    }
    else if (typeof candidate === 'number' || typeof candidate === 'boolean') result[key] = candidate;
    else throw new NovaConfirmationPayloadError(`Campo inválido: ${key}.`);
  }
  return Object.freeze(result);
}

export function readNovaConfirmationPayload(actionKind: ActionKind, value: unknown): Record<string, string | number | boolean> {
  return validateNovaConfirmationPayload(actionKind, value);
}
