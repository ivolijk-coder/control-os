import { getBoolean, getNumber, getString } from '@/services/action-engine';
import type { ActionRequest, DecisionResult } from '@/services/control-hub';
import type { Capability, CapabilityParameterType } from '@/services/capability.types';
import type { CapabilityRegistry } from './capability-registry';

/**
 * Validação da resposta do modelo (CONTROL HUB — Fase 5). "Toda resposta do
 * modelo deverá ser validada. Verificar: JSON válido, Actions existentes
 * (registradas), Parâmetros obrigatórios presentes, Tipos corretos. Em caso
 * de erro: retornar decisão vazia ou erro controlado. Nunca lançar exceção
 * não tratada."
 *
 * Função pura, sem I/O — recebe o texto cru que `LLMProvider.complete`
 * devolveu e o `CapabilityRegistry` (fonte de verdade de "o que existe" e
 * "quais parâmetros cada Action espera"), devolve sempre um `DecisionResult`
 * válido, nunca lança. Isso é o que torna esta função 100% testável sem
 * nenhum modelo real — os 6 casos pedidos ("JSON válido, JSON inválido,
 * Action inexistente, Confidence baixa, Múltiplas Actions, Nenhuma Action")
 * são só chamadas diretas com um texto de entrada fixo.
 */

/** Confiança mínima para uma Action proposta pelo modelo ser realmente executada — abaixo disso, a proposta é descartada (não vira `execute_actions`), mesmo que a Action exista e os parâmetros estejam corretos. Valor conservador (não veio de nenhum experimento — é o mesmo tipo de constante "de bom senso" que `DETERMINISTIC_MATCH_CONFIDENCE` já era no `MockDecisionProvider`); existe pra dar ao Decision Engine uma defesa contra o modelo "confessar" incerteza e mesmo assim ser levado a executar algo. */
export const MIN_CONFIDENCE_TO_EXECUTE = 0.5;

const INVALID_RESPONSE_REPLY =
  'Não consegui interpretar a resposta da IA — nenhuma ação foi executada. Pode tentar reformular?';
const NO_ACTION_REPLY = 'Entendido — não identifiquei nenhuma ação necessária nessa mensagem.';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Formato esperado da saída do modelo — exatamente `{ "actions": [...] }`, exemplo literal do pedido original. */
interface RawDecisionPayload {
  actions: unknown[];
}

function isRawDecisionPayload(value: unknown): value is RawDecisionPayload {
  return isPlainObject(value) && Array.isArray(value.actions);
}

/** Uma ação bruta, já com a forma mínima esperada — `kind` (string) e `parameters` (objeto) presentes; `confidence` é opcional (ausente vira 0, tratado como "sem confiança declarada"). */
interface RawAction {
  kind: string;
  confidence: number | undefined;
  parameters: Record<string, unknown>;
}

function parseRawAction(value: unknown): RawAction | undefined {
  if (!isPlainObject(value)) return undefined;
  if (typeof value.kind !== 'string') return undefined;
  if (!isPlainObject(value.parameters)) return undefined;
  const confidence = typeof value.confidence === 'number' ? value.confidence : undefined;
  return { kind: value.kind, confidence, parameters: value.parameters };
}

/** Reaproveita os mesmos narrowers de `services/action-engine/payload-guards.ts` — "evitar duplicação": o mesmo `getString`/`getNumber`/`getBoolean` que cada Action usa pra ler seu `payload` valida aqui se um parâmetro descrito na `Capability` bate com o tipo declarado. */
function matchesParameterType(payload: Record<string, unknown>, key: string, type: CapabilityParameterType): boolean {
  switch (type) {
    case 'string':
      return getString(payload, key) !== undefined;
    case 'number':
      return getNumber(payload, key) !== undefined;
    case 'boolean':
      return getBoolean(payload, key) !== undefined;
  }
}

/** Confere todo parâmetro obrigatório da Capability contra o `parameters` bruto recebido — devolve o próprio objeto (reaproveitado como `ActionRequest.payload`) se tudo bate, `undefined` no primeiro parâmetro obrigatório ausente ou de tipo errado. */
function validateParameters(raw: RawAction, capability: Capability): Record<string, unknown> | undefined {
  for (const parameter of capability.parameters) {
    if (!parameter.required) continue;
    if (!matchesParameterType(raw.parameters, parameter.name, parameter.type)) return undefined;
  }
  return raw.parameters;
}

/**
 * Ponto de entrada — nunca lança. Cada ação da lista é validada
 * INDEPENDENTEMENTE (uma ação malformada, com Action inexistente ou
 * confidence baixa nunca derruba as outras do mesmo lote — "múltiplas
 * Actions" só falha ação a ação, nunca tudo ou nada).
 */
export function parseLLMDecisionResponse(rawText: string, registry: CapabilityRegistry): DecisionResult {
  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch {
    return { kind: 'reply', reply: INVALID_RESPONSE_REPLY, actions: [] };
  }

  if (!isRawDecisionPayload(json)) {
    return { kind: 'reply', reply: INVALID_RESPONSE_REPLY, actions: [] };
  }

  const validActions: ActionRequest[] = [];
  for (const item of json.actions) {
    const raw = parseRawAction(item);
    if (!raw) continue; // item malformado — ignorado, não derruba o lote

    const capability = registry.find(raw.kind);
    if (!capability) continue; // "a IA nunca deverá inventar Actions" — kind não registrado, ignorado

    const confidence = raw.confidence ?? 0;
    if (confidence < MIN_CONFIDENCE_TO_EXECUTE) continue; // confidence baixa — não executa

    const payload = validateParameters(raw, capability);
    if (!payload) continue; // parâmetro obrigatório ausente ou de tipo errado

    validActions.push({ kind: capability.kind, payload, confidence });
  }

  if (validActions.length === 0) {
    return { kind: 'reply', reply: NO_ACTION_REPLY, actions: [] };
  }

  return { kind: 'execute_actions', actions: validActions };
}
