import type { ActionRequest, ActionResult } from './action-engine.types';
import type { DecisionResult } from './decision-engine.types';
import type { NovaGatewayResult } from './nova-gateway.types';
import type { HubContext, HubMessage, HubPipelineResult } from './control-hub.types';

/**
 * Contratos do CONTROL HUB — cada interface aqui é a fronteira de uma
 * responsabilidade única do pipeline (ver diagrama no pedido original:
 * Receive → Validate → Normalize → Load Context → Send to NOVA → Decision
 * Engine → Action Engine → Return Result). `control-hub.service.ts`
 * depende só destas interfaces, nunca das implementações concretas
 * diretamente — baixo acoplamento: trocar `StubContextManager` por um
 * Context Manager real (Etapa futura, com banco de dados) não muda uma
 * linha de `ControlHubService`.
 */

/**
 * Todo canal (`channels/whatsapp`, `channels/app`, `channels/web`,
 * `channels/api`, e no futuro `channels/telegram` etc.) implementa isto.
 * `TInbound` é o formato NATIVO daquele canal (payload de webhook do
 * WhatsApp, evento do app, request da API pública...) — cada adapter
 * define o seu; `toHubMessage` é o único lugar onde esse formato nativo
 * existe, o resto do sistema nunca o vê.
 */
export interface ChannelAdapter<TInbound = unknown> {
  readonly channel: HubMessage['channel'];
  /** Converte o payload nativo do canal para o envelope universal — todo canal É obrigado a produzir um `HubMessage` válido aqui. */
  toHubMessage(raw: TInbound): HubMessage;
}

/**
 * Ponto único de entrada do CONTROL OS. "O WhatsApp NÃO deve conversar
 * diretamente com a NOVA. Nenhum canal deve conversar diretamente com a
 * IA." — `receive` é o único método que qualquer adapter de canal pode
 * chamar.
 */
export interface ControlHub {
  receive(message: HubMessage): Promise<HubPipelineResult>;
}

/**
 * Monta o contexto que a NOVA (e, futuramente, o Decision Engine) recebe
 * antes de processar a mensagem. Nunca responde ao usuário — só lê e
 * agrega. Implementação real (com fonte de dados de verdade) é trabalho
 * de uma fase futura; ver `context-manager.ts` para o porquê.
 */
export interface ContextManager {
  loadContext(message: HubMessage): Promise<HubContext>;
}

/**
 * Decide o que fazer com uma mensagem já normalizada e com contexto
 * carregado. Ainda sem IA nesta fase (ver `decision-engine.ts`) — recebe
 * exatamente `HubMessage` + `HubContext`, como especificado no pedido
 * original, e devolve um `DecisionResult`.
 */
export interface DecisionEngine {
  decide(message: HubMessage, context: HubContext): Promise<DecisionResult>;
}

/** Executa as ações que o Decision Engine pediu. Nesta fase só a interface existe — ver `action-engine.ts`. */
export interface ActionEngine {
  execute(actions: ActionRequest[]): Promise<ActionResult[]>;
}

/**
 * Ponte entre o CONTROL HUB e a NOVA (`services/nova`/`services/ai`).
 * Interface própria, deliberadamente DESACOPLADA dos tipos internos da
 * NOVA (`NovaContext`, `NovaTurnResult`) — ver doc de `nova-gateway.ts`
 * para a justificativa completa (hoje `NovaContext` exige `actions`
 * vinculadas a um `useDataStore` vivo no navegador, algo que só existe
 * para o canal `web`; um canal server-side como WhatsApp ainda não tem de
 * onde tirar isso).
 */
export interface NovaGateway {
  send(message: HubMessage, context: HubContext): Promise<NovaGatewayResult>;
}
