import type { NovaEventType } from '../events/types';

/**
 * Estado próprio da NOVA (CONTROL OS — Etapa 7: IA-Native — NOVA STATE).
 * "Tudo separado da interface" — este módulo não é uma store de UI
 * (Zustand/React), é um singleton simples do NOVA CORE, atualizado só pelo
 * `NovaObserver` (nunca por uma tela) sempre que um evento chega. Guarda o
 * que a NOVA "sabe de si mesma" — o resultado da sua própria análise
 * contínua — separado do que o usuário vê nas telas (que continuam sendo
 * só visualização/edição, nunca calculam inteligência).
 *
 * Fase atual: em memória, sem persistência entre reloads (nem
 * `sessionStorage` nem `localStorage`) — deliberado, pra manter esta etapa
 * como "preparar infraestrutura", não uma feature completa. Persistir isto
 * é extensão natural e de baixo risco depois (mesmo padrão já usado em
 * `services/nova/memory`: guardar/ler um JSON por chave, com fallback vazio
 * quando `window` não existe).
 */
export interface NovaStateSnapshot {
  lastEventType: NovaEventType | undefined;
  lastEventSummary: string | undefined;
  lastEventAt: string | undefined;
  /** Leitura rápida e real dos números do momento — não é um relatório completo, é o que cabe numa frase. */
  lastAnalysis: string | undefined;
  /** Hoje reaproveita a recomendação mais relevante do momento (ver `services/nova/recommendations`) — ainda não há um motor de insight separado do de recomendação. */
  lastInsight: string | undefined;
  lastRecommendation: string | undefined;
  /** Reaproveita `buildDailyCheckIn` (já existente) — nunca duplica a lógica de resumo do dia. */
  lastDailySummary: string | undefined;
  lastGoalProgressNote: string | undefined;
}

const EMPTY_STATE: NovaStateSnapshot = {
  lastEventType: undefined,
  lastEventSummary: undefined,
  lastEventAt: undefined,
  lastAnalysis: undefined,
  lastInsight: undefined,
  lastRecommendation: undefined,
  lastDailySummary: undefined,
  lastGoalProgressNote: undefined,
};

let state: NovaStateSnapshot = { ...EMPTY_STATE };

/** Devolve uma cópia do estado atual — nunca a referência interna, pra ninguém fora deste módulo poder mutá-la por engano. */
export function getNovaState(): NovaStateSnapshot {
  return { ...state };
}

/** Só o `NovaObserver` chama isto na prática — mas é uma função pura de merge, sem restrição de acesso artificial. */
export function updateNovaState(patch: Partial<NovaStateSnapshot>): void {
  state = { ...state, ...patch };
}

/** Só para testes/dev — nunca chamado em fluxo de produção. */
export function resetNovaState(): void {
  state = { ...EMPTY_STATE };
}
