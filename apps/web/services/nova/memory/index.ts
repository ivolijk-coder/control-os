/**
 * Memória da Nova (CONTROL OS 3.0) — vocabulário de domínio.
 *
 * CONTROL HUB — Fase 3 (Memory Layer): este arquivo NÃO toca mais
 * `sessionStorage`/`localStorage` diretamente — isso foi removido daqui e
 * agora vive exclusivamente em `services/memory/browser-memory-provider.ts`
 * ("nenhum outro módulo poderá acessar sessionStorage", regra explícita
 * do pedido). O que continua aqui é só o VOCABULÁRIO da NOVA
 * (`NovaMemoryEntry`/`NovaFact`/`NovaFactCategory`, as mesmas 4 funções
 * públicas de sempre) traduzido para o `MemoryService` genérico
 * (`services/memory`) por baixo — mesma API pública (à exceção de agora
 * ser assíncrona, ver abaixo), mesmo comportamento observável, storage
 * idêntico (mesmas chaves, mesmos limites, mesmos fatos-semente — ver
 * `browser-memory-provider.ts`), só a implementação mudou de lugar.
 *
 * "Não alterar comportamento, apenas mover a responsabilidade da
 * persistência": as 4 funções públicas viram `async` (antes eram
 * síncronas, porque liam Web Storage diretamente) — consequência
 * inevitável de dependerem agora de uma interface (`MemoryService`)
 * pensada para suportar backends reais no futuro (Postgres/Redis), que
 * são sempre assíncronos. Todos os chamadores já foram (ou estão sendo)
 * atualizados para `await` essas chamadas.
 *
 * `rememberTurn`/`recallRecent` continuam sendo memória de CURTO prazo
 * (uma conversa, uma persona) — agora endereçada como
 * `{ scope: 'short_term', namespace: persona }`. `rememberFact`/
 * `recallFacts` continuam sendo memória de LONGO prazo (durável, por
 * categoria) — `{ scope: 'long_term', namespace: category }`.
 */

import { memoryService } from '@/services/memory';
import type { MemoryEntry } from '@/services/memory';
import type { NovaPersona } from '../interfaces';

export interface NovaMemoryEntry {
  id: string;
  turnSummary: string;
  timestamp: string;
}

const DEFAULT_PERSONA: NovaPersona = 'nova';

function toNovaMemoryEntry(entry: MemoryEntry): NovaMemoryEntry {
  return { id: entry.id, turnSummary: entry.content, timestamp: entry.createdAt };
}

export async function rememberTurn(turnSummary: string, persona: NovaPersona = DEFAULT_PERSONA): Promise<void> {
  await memoryService.remember({ scope: 'short_term', namespace: persona }, turnSummary);
}

export async function recallRecent(persona: NovaPersona = DEFAULT_PERSONA, limit = 5): Promise<NovaMemoryEntry[]> {
  const entries = await memoryService.recall({ scope: 'short_term', namespace: persona }, limit);
  return entries.map(toNovaMemoryEntry);
}

/**
 * Memória estruturada (CONTROL OS — Sistema Operacional Pessoal):
 * preferências, família e rotina — diferente de `NovaMemoryEntry` (resumo
 * bruto de cada turno, curto prazo), um `NovaFact` é uma informação
 * durável sobre o usuário ("prefere ser chamado de Ivoli", "tem uma
 * filha, a Ana", "malha às terças e quintas"). Sobrevive entre sessões —
 * é o que torna a Nova "com memória própria", não só um parser sem
 * estado.
 *
 * Categorias estendidas (CONTROL OS — Etapa 7: IA-Native — Memory
 * Engine): `objetivo_principal`, `prioridade` e `estilo_resposta` cobrem
 * os campos que o Memory Engine (`services/ai/memory`,
 * `buildUserMemoryProfile`) precisa.
 */
export type NovaFactCategory = 'preferencia' | 'familia' | 'rotina' | 'objetivo_principal' | 'prioridade' | 'estilo_resposta';

/** Todas as categorias conhecidas — usada só por `recallFacts()` sem argumento (ver abaixo), pra reunir fatos de toda categoria sem o `MemoryService` genérico precisar conhecer este vocabulário de domínio. */
const ALL_FACT_CATEGORIES: readonly NovaFactCategory[] = [
  'preferencia',
  'familia',
  'rotina',
  'objetivo_principal',
  'prioridade',
  'estilo_resposta',
];

export interface NovaFact {
  id: string;
  category: NovaFactCategory;
  text: string;
  createdAt: string;
}

function toNovaFact(category: NovaFactCategory, entry: MemoryEntry): NovaFact {
  return { id: entry.id, category, text: entry.content, createdAt: entry.createdAt };
}

export async function rememberFact(category: NovaFactCategory, text: string): Promise<NovaFact> {
  const entry = await memoryService.remember({ scope: 'long_term', namespace: category }, text);
  return toNovaFact(category, entry);
}

/**
 * Sem `category`: reúne fatos de TODAS as categorias — feito aqui (que
 * conhece `NovaFactCategory`), não dentro do `MemoryService` genérico (que
 * propositalmente não conhece vocabulário de domínio nenhum, só
 * `scope`/`namespace` string). Cada categoria é uma partição própria
 * (`recall`), lidas em paralelo e depois achatadas em uma única lista —
 * mesmo resultado que a versão antiga (`readAllFacts()` sem filtro),
 * apenas remontado a partir de N leituras genéricas em vez de uma leitura
 * única de uma chave só.
 */
export async function recallFacts(category?: NovaFactCategory): Promise<NovaFact[]> {
  const categories = category ? [category] : ALL_FACT_CATEGORIES;
  const perCategory = await Promise.all(
    categories.map(async (cat) => {
      const entries = await memoryService.recall({ scope: 'long_term', namespace: cat });
      return entries.map((entry) => toNovaFact(cat, entry));
    })
  );
  return perCategory.flat();
}
