import type { ChecklistItem, Trip } from '@control-os/types';
import type { NovaActionResult, NovaContext } from '@/services/nova';
import type { Action } from './types';

/** Viagem anterior real com orçamento definido — narrowing sem cast, usada só por `estimateBudgetFromHistory`. */
type TripWithBudget = Trip & { budget: number };

function hasRealBudget(trip: Trip): trip is TripWithBudget {
  return typeof trip.budget === 'number' && trip.budget > 0;
}

export interface CreateTripInput {
  destination: string;
  startDate: string;
  endDate: string;
  budget?: number;
}

/** Checklist inicial genérico de preparação de viagem — vocabulário já esperado pela tela `/viagens` (`DOCUMENT_KEYWORDS`: passaporte, seguro...). Nunca dado do usuário, só um roteiro padrão de preparação. */
const STARTER_CHECKLIST_LABELS = ['Verificar validade do passaporte', 'Comprar passagens aéreas', 'Reservar hospedagem', 'Contratar seguro viagem'];

let checklistItemIdCounter = 0;

/** Id estável e único pra um item de checklist — mesmo padrão de `nextId` em `lib/data-store.ts`, que não é exportado de lá. */
function nextChecklistItemId(): string {
  checklistItemIdCounter += 1;
  return `trip_item_${Date.now().toString(36)}${checklistItemIdCounter.toString(36)}`;
}

function buildStarterChecklist(): ChecklistItem[] {
  return STARTER_CHECKLIST_LABELS.map((label) => ({ id: nextChecklistItemId(), label, done: false }));
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function tripDurationInDays(startDate: string, endDate: string): number {
  const days = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / MS_PER_DAY);
  return Math.max(1, days + 1);
}

/**
 * Orçamento sugerido (CONTROL OS — Etapa 14: Execution Engine) — "só criar
 * quando houver base real" (decisão explícita do usuário: nunca inventar um
 * valor do zero, mesmo que o exemplo do spec peça um "orçamento sugerido").
 * Só sugere um número quando o usuário já tem pelo menos uma viagem
 * anterior com orçamento real definido — nesse caso, calcula a média de
 * R$/dia dessas viagens reais e aplica sobre a duração da nova viagem. Sem
 * nenhuma viagem de referência, devolve `undefined` — a NOVA nunca chuta um
 * valor sem base.
 */
function estimateBudgetFromHistory(ctx: NovaContext, days: number): number | undefined {
  const referenceTrips = ctx.trips.filter(hasRealBudget);
  if (referenceTrips.length === 0) return undefined;

  const perDayRates = referenceTrips.map((trip) => trip.budget / tripDurationInDays(trip.startDate, trip.endDate));
  const avgPerDay = perDayRates.reduce((sum, rate) => sum + rate, 0) / perDayRates.length;
  return Math.round(avgPerDay * days);
}

/**
 * Comando "criar uma viagem" — resolvido pelo `IntentResolver` a partir da
 * intent `criar_viagem`.
 *
 * CONTROL OS — Etapa 14 (Execution Engine): "Vou viajar para Lisboa em
 * outubro" agora encadeia 3 efeitos numa única Tool call — Criar viagem →
 * Criar checklist inicial → Sugerir orçamento (só com base real) — em vez
 * de deixar checklist e orçamento vazios esperando edição manual em
 * `/viagens`. Cada efeito vira um `NovaActionResult` próprio, mesmo padrão
 * já usado por `createAgendaEvent` (evento + lembrete vinculado + timeline
 * em 3 resultados por 1 chamada).
 */
export class CreateTripAction implements Action {
  constructor(private readonly input: CreateTripInput) {}

  execute(ctx: NovaContext): NovaActionResult[] {
    const checklist = buildStarterChecklist();
    const days = tripDurationInDays(this.input.startDate, this.input.endDate);
    const suggestedBudget = this.input.budget ?? estimateBudgetFromHistory(ctx, days);

    const trip = ctx.actions.addTrip({
      destination: this.input.destination,
      startDate: this.input.startDate,
      endDate: this.input.endDate,
      budget: suggestedBudget,
      checklist,
      spaceId: ctx.defaultSpaceId,
    });

    const timelineEvent = ctx.actions.addTimelineEvent({
      type: 'sistema',
      title: `Viagem criada: ${trip.destination}`,
      timestamp: new Date().toISOString(),
      spaceId: trip.spaceId,
      actor: 'nova',
    });

    const results: NovaActionResult[] = [
      { action: { kind: 'criar_viagem', label: 'Criar viagem' }, ok: true, detail: trip.destination },
      {
        action: { kind: 'criar_checklist_viagem', label: 'Criar checklist inicial' },
        ok: true,
        detail: `${checklist.length} itens de preparação`,
      },
    ];

    // Só entra um resultado de orçamento quando de fato existe um valor —
    // explícito do usuário OU estimado com base real (nunca um resultado
    // "orçamento: nenhum" forçado, mesmo padrão de `buildModelContextSummary`.
    if (suggestedBudget !== undefined) {
      results.push({
        action: { kind: 'sugerir_orcamento_viagem', label: 'Sugerir orçamento' },
        ok: true,
        detail:
          this.input.budget !== undefined
            ? `R$ ${suggestedBudget.toFixed(2)} (informado pelo usuário)`
            : `R$ ${suggestedBudget.toFixed(2)} (estimativa com base em viagens anteriores)`,
      });
    }

    results.push({ action: { kind: 'registrar_timeline', label: 'Atualizar histórico' }, ok: true, detail: timelineEvent.title });

    return results;
  }
}
