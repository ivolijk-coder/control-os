import type { MemoryEntry, MemoryKey, MemoryScope } from './memory.types';

/**
 * Contrato que qualquer backend de memória implementa —
 * `BrowserMemoryProvider` hoje; `PostgresMemoryProvider`,
 * `RedisMemoryProvider`, `SupabaseMemoryProvider`, `MemoryApiProvider`
 * amanhã, sem mudar uma linha de `MemoryService` nem de
 * `ConversationService`. "Dependency Inversion: ConversationService
 * dependerá apenas desta interface, nunca de implementações concretas."
 */
export interface MemoryProvider {
  /** Grava uma nova entrada na partição `key` e devolve a entrada criada (com `id`/`createdAt` gerados). */
  remember(key: MemoryKey, content: string): Promise<MemoryEntry>;
  /** Lê as entradas mais recentes da partição `key`. `limit` ausente = todas. */
  recall(key: MemoryKey, limit?: number): Promise<MemoryEntry[]>;
  /** Busca por conteúdo em todas as partições de um escopo. `query` vazia = todas as entradas do escopo. */
  search(scope: MemoryScope, query: string): Promise<MemoryEntry[]>;
  /** Apaga todas as entradas da partição `key`. */
  clear(key: MemoryKey): Promise<void>;
}

/**
 * Fachada única que `ConversationService` (e qualquer outro consumidor,
 * atual ou futuro) usa — `memoryService.remember()/recall()/search()/
 * clear()`, exatamente como pedido. Mesma forma de `MemoryProvider` de
 * propósito: `MemoryService` é "o que se chama", `MemoryProvider` é "quem
 * de fato guarda os bytes"; `MemoryServiceImpl` (`memory-service.ts`) é o
 * único lugar que sabe a diferença.
 */
export interface MemoryService {
  remember(key: MemoryKey, content: string): Promise<MemoryEntry>;
  recall(key: MemoryKey, limit?: number): Promise<MemoryEntry[]>;
  search(scope: MemoryScope, query: string): Promise<MemoryEntry[]>;
  clear(key: MemoryKey): Promise<void>;
}
