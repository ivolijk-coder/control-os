import type { NovaEvent, NovaEventType } from './types';

/**
 * Event Bus interno do NOVA CORE (CONTROL OS — Etapa 7: IA-Native). Pub-sub
 * síncrono, em memória, dentro do próprio processo — "Não utilizar serviços
 * externos. Não utilizar filas externas." Nenhuma Action publica direto
 * aqui (ver `services/ai/conversation/ConversationService.ts`,
 * `executeAndNarrate`, o único choke point de escrita — é ele quem chama
 * `publish` depois de toda execução bem-sucedida). "Nenhuma Action deve
 * conhecer a NOVA" fica ainda mais garantido assim: nem sabem que este
 * barramento existe.
 *
 * Cada assinante roda dentro de um `try/catch` (`publish` abaixo) — um
 * observador (`NovaObserver`) nunca pode lançar um erro que interrompa a
 * resposta ao usuário; na pior hipótese, ele simplesmente não atualiza o
 * estado interno da NOVA naquele turno.
 */
type NovaEventHandler = (event: NovaEvent) => void;

const handlersByType = new Map<NovaEventType, Set<NovaEventHandler>>();
const globalHandlers = new Set<NovaEventHandler>();

/** Assina um tipo específico de evento. Devolve uma função de cancelamento. */
export function subscribe(type: NovaEventType, handler: NovaEventHandler): () => void {
  const set = handlersByType.get(type) ?? new Set<NovaEventHandler>();
  set.add(handler);
  handlersByType.set(type, set);
  return () => set.delete(handler);
}

/** Assina TODOS os eventos, independente do tipo — usado pelo `NovaObserver`, que acompanha tudo. */
export function subscribeAll(handler: NovaEventHandler): () => void {
  globalHandlers.add(handler);
  return () => globalHandlers.delete(handler);
}

/**
 * Publica um evento — chama, em ordem, os assinantes do tipo específico e
 * depois os assinantes globais. Cada chamada é isolada em `try/catch`: um
 * assinante com bug nunca derruba os demais nem a resposta ao usuário.
 */
export function publish(event: NovaEvent): void {
  const specific = handlersByType.get(event.type);
  if (specific) {
    for (const handler of specific) {
      try {
        handler(event);
      } catch {
        // Um observador nunca pode quebrar o turno de conversa — ver doc do módulo.
      }
    }
  }
  for (const handler of globalHandlers) {
    try {
      handler(event);
    } catch {
      // Idem.
    }
  }
}
