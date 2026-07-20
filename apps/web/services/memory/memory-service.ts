import { BrowserMemoryProvider } from './browser-memory-provider';
import type { MemoryProvider, MemoryService } from './memory.interfaces';
import type { MemoryEntry, MemoryKey, MemoryScope } from './memory.types';

const browserMemoryProvider = new BrowserMemoryProvider();

/**
 * MemoryServiceImpl — a fachada central que `ConversationService` (e
 * qualquer consumidor futuro) chama. "ConversationService dependerá
 * apenas desta interface [`MemoryService`], nunca de implementações
 * concretas" — em código, isso é `MemoryService` (o tipo do parâmetro/
 * campo em quem consome), nunca `MemoryServiceImpl` diretamente.
 *
 * CONTROL OS — "pense como o arquiteto principal... suporte múltiplos
 * providers de memória": recebe UM provider por escopo, não um só —
 * `shortTermProvider`/`longTermProvider` podem ser instâncias
 * DIFERENTES. Hoje os dois apontam pro mesmo `BrowserMemoryProvider`
 * (só o navegador tem onde guardar isso ainda), mas o padrão comum em
 * produção é short-term em algo rápido/efêmero (Redis) e long-term em
 * algo durável (Postgres) — exatamente os dois providers citados na seção
 * "Futura Escalabilidade" do pedido original. Essa divisão já existir
 * aqui significa que, quando `RedisMemoryProvider`/`PostgresMemoryProvider`
 * forem implementados, a troca é passar dois argumentos diferentes no
 * construtor — nenhuma outra linha do sistema muda.
 */
export class MemoryServiceImpl implements MemoryService {
  constructor(
    private readonly shortTermProvider: MemoryProvider = browserMemoryProvider,
    private readonly longTermProvider: MemoryProvider = browserMemoryProvider
  ) {}

  private providerFor(scope: MemoryScope): MemoryProvider {
    return scope === 'short_term' ? this.shortTermProvider : this.longTermProvider;
  }

  async remember(key: MemoryKey, content: string): Promise<MemoryEntry> {
    return this.providerFor(key.scope).remember(key, content);
  }

  async recall(key: MemoryKey, limit?: number): Promise<MemoryEntry[]> {
    return this.providerFor(key.scope).recall(key, limit);
  }

  async search(scope: MemoryScope, query: string): Promise<MemoryEntry[]> {
    return this.providerFor(scope).search(scope, query);
  }

  async clear(key: MemoryKey): Promise<void> {
    return this.providerFor(key.scope).clear(key);
  }
}

export const memoryService: MemoryService = new MemoryServiceImpl();
