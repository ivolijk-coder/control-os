import type { ContextManager } from './control-hub.interfaces';
import { createEmptyHubContext, type HubContext, type HubMessage } from './control-hub.types';

/**
 * Context Manager — "monta o contexto antes da NOVA receber a mensagem",
 * nunca responde ao usuário. Nesta fase é só estrutura, como pedido
 * explicitamente ("Nesta primeira etapa apenas criar a estrutura").
 *
 * Por que `StubContextManager` devolve sempre um contexto vazio, em vez
 * de já ligar em `useDataStore` (que já tem agenda, financeiro, metas,
 * hábitos, patrimônio, notas e documentos reais, mockados):
 * `useDataStore` é um hook Zustand que só existe dentro de uma árvore
 * React, no navegador, vinculado à sessão de UM usuário logado ali — é
 * exatamente a fonte que `NovaContext` (`services/nova/interfaces`) usa
 * hoje, mas ela não é alcançável a partir de um canal server-side (ex.: um
 * webhook do WhatsApp rodando numa Route Handler). Ligar o Context Manager
 * a uma fonte de dados de verdade — compartilhada entre canais, por
 * `userId`, não por sessão de navegador — é trabalho de uma fase futura
 * (depende de banco de dados/persistência, explicitamente fora do escopo
 * desta etapa). Documentar essa lacuna aqui é intencional: é o principal
 * ponto de atenção para quando o CONTROL HUB for ligado a um canal real.
 */
export class StubContextManager implements ContextManager {
  async loadContext(message: HubMessage): Promise<HubContext> {
    return createEmptyHubContext(message.userId);
  }
}

export const contextManager: ContextManager = new StubContextManager();
