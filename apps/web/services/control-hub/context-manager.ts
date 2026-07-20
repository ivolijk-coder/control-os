import { contextProvider as defaultContextProvider } from '@/services/context-provider';
import type { ContextProvider, UserContext } from '@/services/context-provider';
import type { ContextManager } from './control-hub.interfaces';
import type { HubMessage } from './control-hub.types';

/**
 * Context Manager — CONTROL HUB, Fase 2: "Hoje o Context Manager possui
 * mocks. Quero que ele deixe de construir contexto. Sua única
 * responsabilidade será solicitar contexto ao Context Provider."
 *
 * Antes (Fase 1, `StubContextManager` — removido) esta classe MONTAVA um
 * contexto vazio sozinha. Agora ela não sabe montar nada — só extrai
 * `userId` da mensagem e delega ao `ContextProvider`
 * (`services/context-provider`), que é quem de fato conhece os módulos do
 * sistema (Agenda, Financeiro, Metas, Hábitos, Patrimônio, Notas,
 * Documentos, Conversas). Isso É a inversão de dependência pedida: nem o
 * `ControlHubService` nem este `ContextManagerImpl` sabem COMO um
 * `UserContext` é montado — só que ele pode ser pedido.
 */
export class ContextManagerImpl implements ContextManager {
  constructor(private readonly contextProvider: ContextProvider = defaultContextProvider) {}

  async loadContext(message: HubMessage): Promise<UserContext> {
    return this.contextProvider.getUserContext(message.userId);
  }
}

export const contextManager: ContextManager = new ContextManagerImpl();
