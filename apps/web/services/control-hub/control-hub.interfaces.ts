import type { ActionRequest, ActionResult } from './action-engine.types';
import type { DecisionResult } from './decision-engine.types';
import type { NovaGatewayResult } from './nova-gateway.types';
import type { HubMessage, HubPipelineResult } from './control-hub.types';
import type { UserContext } from '@/services/context-provider';

/**
 * Contratos do CONTROL HUB — cada interface aqui é a fronteira de uma
 * responsabilidade única do pipeline (ver diagrama no pedido original:
 * Receive → Validate → Normalize → Load Context → Send to NOVA → Decision
 * Engine → Action Engine → Return Result). `control-hub.service.ts`
 * depende só destas interfaces, nunca das implementações concretas
 * diretamente — baixo acoplamento: trocar `ContextManagerImpl` por outra
 * implementação não muda uma linha de `ControlHubService`.
 *
 * CONTROL HUB — Fase 2: o contexto que passeia por `ContextManager`,
 * `DecisionEngine` e `NovaGateway` agora é `UserContext`
 * (`services/context-provider`), não mais um `HubContext` próprio deste
 * módulo (removido). "A NOVA nunca mais deverá acessar Zustand, React ou
 * qualquer estado do frontend" — `UserContext` é o único objeto de
 * contexto que atravessa essa fronteira.
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
 * antes de processar a mensagem. Nunca responde ao usuário — só pede o
 * contexto pronto ao Context Provider e devolve. Ver `context-manager.ts`
 * — desde a Fase 2, esta é sua ÚNICA responsabilidade (deixou de montar
 * contexto sozinho).
 */
export interface ContextManager {
  loadContext(message: HubMessage): Promise<UserContext>;
}

/**
 * Decide o que fazer com uma mensagem já normalizada e com contexto
 * carregado. Ainda sem IA nesta fase (ver `decision-engine.ts`) — recebe
 * exatamente `HubMessage` + `UserContext`, como especificado no pedido
 * original, e devolve um `DecisionResult`.
 */
export interface DecisionEngine {
  decide(message: HubMessage, context: UserContext): Promise<DecisionResult>;
}

/** Executa as ações que o Decision Engine pediu. Nesta fase só a interface existe — ver `action-engine.ts`. */
export interface ActionEngine {
  execute(actions: ActionRequest[]): Promise<ActionResult[]>;
}

/**
 * Ponte entre o CONTROL HUB e a NOVA (`services/nova`/`services/ai`).
 * Interface própria, deliberadamente DESACOPLADA dos tipos internos da
 * NOVA (`NovaContext`, `NovaTurnResult`) — ver doc de `nova-gateway.ts`
 * para a justificativa completa e para o achado confirmado na Fase 2: a
 * NOVA depende do navegador em DOIS pontos, não só um (`NovaContext.actions`
 * vinculadas ao `useDataStore`, E a memória de conversa da
 * `ConversationService` lendo/escrevendo em `sessionStorage` diretamente).
 */
export interface NovaGateway {
  send(message: HubMessage, context: UserContext): Promise<NovaGatewayResult>;
}
