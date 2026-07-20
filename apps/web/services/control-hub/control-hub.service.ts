import { validateHubMessage } from './validate-message';
import { normalizeHubMessage } from './normalize-message';
import { contextManager as defaultContextManager } from './context-manager';
import { decisionEngine as defaultDecisionEngine } from './decision-engine';
import { novaGateway as defaultNovaGateway } from './nova-gateway';
import { actionRegistry as defaultActionEngine } from '@/services/action-engine';
import type {
  ActionEngine,
  ContextManager,
  ControlHub,
  DecisionEngine,
  NovaGateway,
} from './control-hub.interfaces';
import type { HubMessage, HubPipelineResult } from './control-hub.types';

/**
 * CONTROL HUB — o coração da nova arquitetura de comunicação do CONTROL
 * OS. "Ele será responsável por receber todas as mensagens e eventos,
 * normalizá-los e enviá-los para a NOVA." `receive` é o único ponto de
 * entrada — nenhum canal (`channels/whatsapp`, `channels/app`,
 * `channels/web`, `channels/api`, e futuros) chama nada além disto.
 *
 * Pipeline (cada etapa é uma responsabilidade isolada, delegada a um
 * colaborador injetado — nunca lógica misturada aqui dentro):
 *
 *   Receive → Validate → Normalize → Load Context → Send to NOVA →
 *   Decision Engine → Action Engine → Return Result
 *
 * Sem `.controller.ts` / `.module.ts` (diferente do exemplo original do
 * pedido, que segue a convenção NestJS): este monorepo não usa um
 * framework de injeção de dependência — não existe NestJS aqui. Os dois
 * papéis viram, respectivamente: (a) "controller" — no Next.js, quem
 * expõe um endpoint HTTP é uma Route Handler (`app/api/.../route.ts`);
 * criar uma agora seria implementar um webhook, explicitamente fora do
 * escopo desta fase ("Ainda NÃO implementar: Webhooks") — quando um canal
 * precisar de endpoint HTTP real, a Route Handler correspondente chama só
 * `controlHub.receive(...)`, igual a qualquer outro adapter; (b) "module"
 * (registro de DI) — substituído pelo barrel `index.ts` + pela instância
 * `controlHub` já pronta abaixo, mesmo padrão de composition root já usado
 * por `services/ai/index.ts` (`conversationService`) e
 * `services/nova/index.ts`.
 *
 * Injeção via construtor (com defaults para as implementações desta fase)
 * é o que garante baixo acoplamento: trocar `ContextManagerImpl` por um
 * Context Manager com outra fonte, ou `MockDecisionEngine` por um de
 * verdade, é passar outra implementação no construtor — nenhuma linha deste arquivo
 * muda.
 */
export class ControlHubService implements ControlHub {
  constructor(
    private readonly contextManager: ContextManager = defaultContextManager,
    private readonly decisionEngine: DecisionEngine = defaultDecisionEngine,
    private readonly novaGateway: NovaGateway = defaultNovaGateway,
    /**
     * CONTROL HUB — Fase 4: "o Action Engine passa a ser o executor oficial
     * do CONTROL OS." Até a Fase 3 este parâmetro não tinha default (só
     * interface existia); agora tem — `actionRegistry`
     * (`services/action-engine`), a primeira implementação real. Continua
     * injetável por construtor (trocar por outra implementação, ou por um
     * stub em teste, não muda uma linha deste arquivo).
     */
    private readonly actionEngine: ActionEngine = defaultActionEngine
  ) {}

  async receive(message: HubMessage): Promise<HubPipelineResult> {
    const pipelineStartedAt = Date.now();

    const validation = validateHubMessage(message);
    if (!validation.valid) {
      return { status: 'rejected', message, error: validation.errors.join('; ') };
    }

    const normalized = normalizeHubMessage(message);

    const contextStartedAt = Date.now();
    const context = await this.contextManager.loadContext(normalized);
    const contextMs = Date.now() - contextStartedAt;

    // "Send to NOVA" e "Decision Engine" rodam sobre a mesma entrada
    // (mensagem normalizada + contexto) — contrato explícito do pedido
    // original para o Decision Engine ("Ela deverá receber: HubMessage +
    // Context"). A decisão final de texto de resposta prioriza o Decision
    // Engine (é o componente cujo papel é decidir o que volta pro canal) e
    // só cai para a resposta da NOVA se o Decision Engine não tiver uma.
    const novaResult = await this.novaGateway.send(normalized, context);
    const decisionStartedAt = Date.now();
    const decision = await this.decisionEngine.decide(normalized, context);
    const decisionMs = Date.now() - decisionStartedAt;

    // Etapa "Action Engine" — CONTROL HUB Fase 4: agora roda de verdade
    // quando o Decision Engine pede ações (`decision.actions` não vazio).
    // "A NOVA nunca deverá modificar diretamente Agenda/Financeiro/
    // Hábitos/Metas/Notas/Documentos. Ela apenas decide. Quem executa
    // sempre será o Action Engine." — é este `execute` que dispara os
    // Module Services (`services/modules/*`), nunca o Decision Engine nem
    // o Nova Gateway diretamente.
    const actionStartedAt = Date.now();
    const actionResults = decision.actions.length > 0 ? await this.actionEngine.execute(decision.actions) : [];
    const actionMs = Date.now() - actionStartedAt;

    // Sem resposta explícita do Decision Engine (`kind: 'execute_actions'`
    // nunca carrega `reply`, ver `decision-engine.types.ts`): a resposta ao
    // usuário nasce das mensagens que cada `ActionResult` já devolveu — "o
    // Action Engine é quem realmente movimenta o sistema", inclusive a
    // resposta final quando a mensagem virou uma ação de verdade.
    const actionReply = actionResults.length > 0 ? actionResults.map((result) => result.message).join(' ') : undefined;

    return {
      status: 'ok',
      message: normalized,
      reply: decision.reply ?? actionReply ?? novaResult.reply,
      actionResults: actionResults.length > 0 ? actionResults : undefined,
      // CONTROL HUB — Fase 5: "Observabilidade — registrar tempo de montagem
      // de contexto, chamada ao LLM, execução das actions, tempo total."
      metrics: { contextMs, decisionMs, actionMs, totalMs: Date.now() - pipelineStartedAt },
    };
  }
}

export const controlHub: ControlHub = new ControlHubService();
