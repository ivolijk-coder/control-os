import { buildDailyCheckIn } from '../conversation/daily-checkin';
import { subscribeAll } from '../events/eventBus';
import type { NovaEvent } from '../events/types';
import { buildQuickAnalysis, generateRecommendations } from '../recommendations';
import { updateNovaState } from '../state';

/**
 * NOVA Observer (CONTROL OS — Etapa 7: IA-Native). "A NOVA CORE escuta os
 * eventos. Ela nunca interfere na Action. Ela apenas observa." — este
 * módulo só assina o Event Bus (`subscribeAll`) e atualiza o NOVA State;
 * nunca chama `ctx.actions`, nunca publica um evento novo, nunca lança uma
 * exceção que possa escapar (o `eventBus.publish` já isola cada assinante
 * em `try/catch`, mas a lógica abaixo também evita qualquer chamada que
 * possa falhar de forma inesperada).
 *
 * Import de efeito colateral: `services/nova/index.ts` importa este módulo
 * (`import './observer'`) só pelo efeito de rodar `subscribeAll` abaixo —
 * não porque algum consumidor externo precise de uma exportação daqui.
 * Assim, sempre que `services/nova` é carregado (todo `ConversationService`
 * carrega), o Observer já está de pé, sem nenhuma tela precisar chamar nada
 * pra "ligar" a observação contínua.
 */
subscribeAll((event: NovaEvent) => {
  const recommendations = generateRecommendations(event.context);
  const [topRecommendation] = recommendations;
  const metaEmDestaque = [...event.context.missions]
    .filter((mission) => mission.kind === 'meta')
    .sort((a, b) => b.progress - a.progress)[0];

  updateNovaState({
    lastEventType: event.type,
    lastEventSummary: event.summary,
    lastEventAt: event.occurredAt,
    lastAnalysis: buildQuickAnalysis(event.context),
    // Ainda não há um motor de insight separado do de recomendação nesta
    // etapa — "insight" reaproveita a recomendação mais relevante do
    // momento (ver doc de `NovaStateSnapshot.lastInsight`).
    lastInsight: topRecommendation?.message,
    lastRecommendation: topRecommendation?.message,
    lastDailySummary: buildDailyCheckIn(
      event.context.missions,
      event.context.agendaEvents,
      event.context.financeEntries,
      event.context.habits,
      event.context.userName
    ),
    lastGoalProgressNote: metaEmDestaque ? `${metaEmDestaque.title}: ${metaEmDestaque.progress}%` : undefined,
  });
});
