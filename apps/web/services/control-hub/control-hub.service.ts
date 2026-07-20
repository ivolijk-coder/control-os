import { validateHubMessage } from './validate-message';
import { normalizeHubMessage } from './normalize-message';
import { contextManager as defaultContextManager } from './context-manager';
import { decisionEngine as defaultDecisionEngine } from './decision-engine';
import { novaGateway as defaultNovaGateway } from './nova-gateway';
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
 * é o que garante baixo acoplamento: trocar `StubContextManager` por um
 * Context Manager real, ou `MockDecisionEngine` por um de verdade, é
 * passar outra implementação no construtor — nenhuma linha deste arquivo
 * muda.
 */
export class ControlHubService implements ControlHub {
  constructor(
    private readonly contextManager: ContextManager = defaultContextManager,
    private readonly decisionEngine: DecisionEngine = defaultDecisionEngine,
    private readonly novaGateway: NovaGateway = defaultNovaGateway,
    /**
     * Opcional e sem default nesta fase de propósito: o Action Engine
     * ainda só tem interface (`control-hub.interfaces.ts` +
     * `action-engine.types.ts`), nenhuma implementação — "Nesta etapa
     * criar apenas as interfaces", pedido explícito. `MockDecisionEngine`
     * nunca produz `actions` não vazias, então `receive` abaixo nunca
     * precisa chamar isto na prática hoje; o parâmetro existe só para o
     * pipeline já ter o formato certo quando uma implementação real
     * chegar.
     */
    private readonly actionEngine?: ActionEngine
  ) {}

  async receive(message: HubMessage): Promise<HubPipelineResult> {
    const validation = validateHubMessage(message);
    if (!validation.valid) {
      return { status: 'rejected', message, error: validation.errors.join('; ') };
    }

    const normalized = normalizeHubMessage(message);
    const context = await this.contextManager.loadContext(normalized);

    // "Send to NOVA" e "Decision Engine" rodam sobre a mesma entrada
    // (mensagem normalizada + contexto) — contrato explícito do pedido
    // original para o Decision Engine ("Ela deverá receber: HubMessage +
    // Context"). Nesta fase, os dois são mocks independentes; a decisão
    // final de texto de resposta prioriza o Decision Engine (é o
    // componente cujo papel é decidir o que volta pro canal) e só cai
    // para a resposta da NOVA se o Decision Engine não tiver uma.
    const novaResult = await this.novaGateway.send(normalized, context);
    const decision = await this.decisionEngine.decide(normalized, context);

    // Etapa "Action Engine" — só executa quando o Decision Engine de fato
    // pedir ações (`decision.actions` não vazio) E uma implementação real
    // estiver injetada. Com `MockDecisionEngine`, `decision.actions` é
    // sempre `[]`, então este bloco nunca roda na prática hoje — o
    // encanamento já existe pronto para quando o Decision Engine real
    // chegar; `HubPipelineResult` ganha um campo de resultados de ação
    // nesse momento (nenhum consumidor depende disso ainda).
    if (decision.actions.length > 0 && this.actionEngine) {
      await this.actionEngine.execute(decision.actions);
    }

    return {
      status: 'ok',
      message: normalized,
      reply: decision.reply ?? novaResult.reply,
    };
  }
}

export const controlHub: ControlHub = new ControlHubService();
