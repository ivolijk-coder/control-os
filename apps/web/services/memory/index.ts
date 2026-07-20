/**
 * Ponto único de importação da Memory Layer (CONTROL HUB — Fase 3).
 * Consumidores (`services/nova/memory`, e futuramente qualquer canal
 * server-side) importam só daqui — nunca de `memory-service.ts` ou
 * `browser-memory-provider.ts` diretamente. Mesma convenção de
 * `services/control-hub/index.ts` e `services/context-provider/index.ts`.
 */
export { MemoryServiceImpl, memoryService } from './memory-service';
export { BrowserMemoryProvider } from './browser-memory-provider';
export type { MemoryProvider, MemoryService } from './memory.interfaces';
export type { MemoryEntry, MemoryKey, MemoryScope } from './memory.types';
