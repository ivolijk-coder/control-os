import { MockDecisionProvider, OpenAIDecisionProvider } from '@/services/decision-engine';
import type { DecisionEngine } from './control-hub.interfaces';

/**
 * CONTROL HUB — Fase 5: Decision Engine com IA. Este arquivo deixou de
 * CONTER a lógica de decisão (regex determinística, antes chamada
 * `MockDecisionEngine`) — ela foi movida para
 * `services/decision-engine/mock-decision-provider.ts` (renomeada
 * `MockDecisionProvider`, mesmo comportamento, zero mudança observável).
 *
 * Agora este arquivo é só a COMPOSIÇÃO RAIZ que escolhe qual `DecisionEngine`
 * fica ativo — "Criar dois modos: MockDecisionProvider e
 * OpenAIDecisionProvider. Trocar entre eles apenas por configuração.
 * Nenhum outro módulo deverá mudar." Mesmo padrão já usado em
 * `services/ai/config.ts` (`getAIProvider()`) para o pipeline de conversa
 * antigo, agora espelhado aqui — `DECISION_PROVIDER` é o equivalente
 * server-only de `AI_PROVIDER` (não precisa do prefixo `NEXT_PUBLIC_`:
 * Decision Engine só roda dentro do Control Hub, 100% server-side; nenhum
 * componente `'use client'` importa `services/control-hub`, confirmado por
 * auditoria desta fase).
 *
 * Por que a lógica NÃO mora mais aqui, mas em `services/decision-engine/`:
 * a partir desta fase o Decision Engine ganhou peso próprio (Capability
 * Registry, Prompt Builder, validação de JSON, dois providers) —
 * exatamente o mesmo motivo pelo qual `ActionResult` e o Action Engine
 * inteiro já não moram dentro de `services/control-hub` desde a Fase 4.
 * `services/control-hub` continua sendo só o orquestrador do pipeline
 * (Receive → Validate → Normalize → Load Context → Send to NOVA → Decision
 * Engine → Action Engine → Return Result); cada etapa pesada vive no seu
 * próprio módulo, meramente CONSULTADA por aqui.
 */
const DECISION_PROVIDER: 'mock' | 'openai' = process.env.DECISION_PROVIDER === 'openai' ? 'openai' : 'mock';

function createDecisionEngine(): DecisionEngine {
  return DECISION_PROVIDER === 'openai' ? new OpenAIDecisionProvider() : new MockDecisionProvider();
}

export const decisionEngine: DecisionEngine = createDecisionEngine();
