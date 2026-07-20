/**
 * Observabilidade do Decision Engine (CONTROL HUB — Fase 5). "Métricas
 * simples: registrar tempo de montagem de contexto, chamada ao LLM,
 * execução das actions, tempo total. Não utilizar ferramentas externas.
 * Apenas estrutura preparada para evolução futura."
 *
 * Cobre a parte "chamada ao LLM" (dentro de `OpenAIDecisionProvider`) —
 * "montagem de contexto"/"execução das actions"/"tempo total" são etapas do
 * PIPELINE inteiro, não só do Decision Engine, e por isso são medidas em
 * `ControlHubService.receive` (`HubPipelineResult.metrics`,
 * `services/control-hub/control-hub.types.ts`), que já é o único lugar que
 * vê as quatro etapas em sequência.
 *
 * Deliberadamente sem nenhuma biblioteca de tracing/telemetria — só um
 * `console.log` condicional (mesmo padrão de `logDebug`,
 * `app/api/ai/nova/route.ts`, gated por `AI_DEBUG_LOGS`) mais um tipo
 * exportado, pronto para um dia virar um export real (Datadog, OpenTelemetry
 * etc.) sem mudar quem chama `logDecisionEngineTiming`.
 */
export interface DecisionEngineTiming {
  promptBuildMs: number;
  llmCallMs: number;
  validationMs: number;
  totalMs: number;
}

const DECISION_ENGINE_DEBUG_LOGS = process.env.DECISION_ENGINE_DEBUG_LOGS === '1';

export function logDecisionEngineTiming(timing: DecisionEngineTiming): void {
  if (!DECISION_ENGINE_DEBUG_LOGS) return;
  // eslint-disable-next-line no-console -- log de desenvolvimento, desligado em produção por padrão.
  console.log('[decision-engine]', timing);
}
