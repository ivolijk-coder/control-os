/**
 * CONTROL HUB — Fase 3: Memory Layer.
 *
 * "A ConversationService nunca mais deverá acessar sessionStorage
 * diretamente. Ela deverá conversar apenas com uma interface." Este
 * módulo é essa interface — e tudo por trás dela.
 *
 * Dois níveis de memória, exatamente como pedido:
 * - `'short_term'`: memória operacional — conversa atual, últimas
 *   mensagens, contexto imediato. Efêmera por natureza (hoje: por sessão
 *   de navegador; amanhã: talvez Redis, TTL curto).
 * - `'long_term'`: conhecimento durável — preferências, pessoas
 *   importantes, empresas, lugares, hábitos conhecidos, perfil. Sobrevive
 *   entre sessões (hoje: `localStorage`; amanhã: Postgres).
 *
 * Um único `namespace` (string) particiona cada escopo — para
 * `short_term` é a persona da conversa (`'nova'`/`'legendary'`); para
 * `long_term` é a categoria do fato (`'preferencia'`, `'rotina'`...). Não
 * há um tipo fechado (union) aqui de propósito: essa camada é infra pura,
 * agnóstica de vocabulário de domínio — quem sabe o vocabulário certo é
 * `services/nova/memory` (ver `NovaFactCategory`), que continua existindo
 * como a camada de domínio por cima desta.
 */
export type MemoryScope = 'short_term' | 'long_term';

/** Endereço de uma memória — escopo + partição dentro do escopo. */
export interface MemoryKey {
  scope: MemoryScope;
  namespace: string;
}

/** Uma unidade de memória já persistida. */
export interface MemoryEntry {
  id: string;
  content: string;
  createdAt: string;
}
