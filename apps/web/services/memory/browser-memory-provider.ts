import type { MemoryProvider } from './memory.interfaces';
import type { MemoryEntry, MemoryKey, MemoryScope } from './memory.types';

/**
 * BrowserMemoryProvider — "ela será a única responsável por utilizar
 * sessionStorage. Toda referência ao sessionStorage deverá ficar
 * exclusivamente dentro desta implementação. Nenhum outro módulo poderá
 * acessar sessionStorage." Também é a única a usar `localStorage` (memória
 * de longo prazo) — mesma regra, mesmo motivo.
 *
 * Reimplementa, sem mudar, a lógica que já existia em
 * `services/nova/memory` (removida de lá nesta fase): MESMAS chaves de
 * storage (`control-os-nova-memory_<persona>`, `control-os-nova-facts`),
 * MESMOS limites (20 entradas curtas, 100 fatos), MESMOS fatos-semente.
 * Qualquer dado já gravado no navegador de quem testou fases anteriores
 * continua sendo lido normalmente — "não alterar comportamento" levado a
 * sério até no formato em disco, não só na resposta observável.
 *
 * Limitação conhecida e documentada (mock de fundação, não real): `search`
 * em `short_term` precisa saber quais namespaces (personas) existem pra
 * variar entre eles, e a Web Storage API não tem um jeito nativo de listar
 * "todas as chaves que existem para este escopo" sem depender de convenção
 * — por isso `KNOWN_SHORT_TERM_NAMESPACES` abaixo é uma lista fechada
 * (as personas já são um union fechado em todo o resto do projeto,
 * `NovaPersona`). Um provider real (Postgres/Redis) resolve isso com uma
 * query normal — não precisa de lista alguma.
 */

const SHORT_TERM_KEY_PREFIX = 'control-os-nova-memory_';
const MAX_SHORT_TERM_ENTRIES = 20;
/** Mesmo union de `NovaPersona` (`services/nova/interfaces`) — não importado daqui de propósito: este módulo não conhece vocabulário de domínio, só uma lista fechada de partições conhecidas para o mock funcionar. */
const KNOWN_SHORT_TERM_NAMESPACES = ['nova', 'legendary'];

const LONG_TERM_KEY = 'control-os-nova-facts';
const MAX_LONG_TERM_ENTRIES = 100;
const SEED_LONG_TERM_FACTS: readonly { namespace: string; text: string }[] = [
  { namespace: 'preferencia', text: 'Prefere respostas diretas, sem enrolação.' },
  { namespace: 'rotina', text: 'Costuma revisar o Financeiro toda segunda de manhã.' },
];

/** Forma em disco de uma entrada de curto prazo — igual ao `NovaMemoryEntry` original, preservada por compatibilidade de dados já gravados. */
interface StoredShortTermEntry {
  id: string;
  turnSummary: string;
  timestamp: string;
}

/** Forma em disco de um fato de longo prazo — igual ao `NovaFact` original (campo `category` é o que vira `namespace`). */
interface StoredLongTermFact {
  id: string;
  category: string;
  text: string;
  createdAt: string;
}

function isStoredShortTermEntry(value: unknown): value is StoredShortTermEntry {
  if (typeof value !== 'object' || value === null) return false;
  if (!('id' in value) || !('turnSummary' in value) || !('timestamp' in value)) return false;
  return typeof value.id === 'string' && typeof value.turnSummary === 'string' && typeof value.timestamp === 'string';
}

function isStoredLongTermFact(value: unknown): value is StoredLongTermFact {
  if (typeof value !== 'object' || value === null) return false;
  if (!('id' in value) || !('category' in value) || !('text' in value) || !('createdAt' in value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.category === 'string' &&
    typeof value.text === 'string' &&
    typeof value.createdAt === 'string'
  );
}

function toMemoryEntry(stored: StoredShortTermEntry | StoredLongTermFact): MemoryEntry {
  return 'turnSummary' in stored
    ? { id: stored.id, content: stored.turnSummary, createdAt: stored.timestamp }
    : { id: stored.id, content: stored.text, createdAt: stored.createdAt };
}

function readShortTerm(namespace: string): StoredShortTermEntry[] {
  if (typeof window === 'undefined') return [];
  const raw = window.sessionStorage.getItem(`${SHORT_TERM_KEY_PREFIX}${namespace}`);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isStoredShortTermEntry) : [];
  } catch {
    return [];
  }
}

function writeShortTerm(namespace: string, entries: StoredShortTermEntry[]): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(`${SHORT_TERM_KEY_PREFIX}${namespace}`, JSON.stringify(entries.slice(-MAX_SHORT_TERM_ENTRIES)));
}

function readLongTerm(): StoredLongTermFact[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(LONG_TERM_KEY);
  if (!raw) {
    // Primeira carga: semeia com os fatos de exemplo, mesmo comportamento
    // que `services/nova/memory` já tinha, pra `recall`/`search` nunca
    // começarem vazios sem nenhum dado de demonstração.
    const seeded = SEED_LONG_TERM_FACTS.map((fact, index) => ({
      id: `fact_seed_${index}`,
      category: fact.namespace,
      text: fact.text,
      createdAt: new Date().toISOString(),
    }));
    writeLongTerm(seeded);
    return seeded;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isStoredLongTermFact) : [];
  } catch {
    return [];
  }
}

function writeLongTerm(facts: StoredLongTermFact[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LONG_TERM_KEY, JSON.stringify(facts.slice(-MAX_LONG_TERM_ENTRIES)));
}

function matchesQuery(content: string, query: string): boolean {
  return query.trim().length === 0 || content.toLowerCase().includes(query.trim().toLowerCase());
}

export class BrowserMemoryProvider implements MemoryProvider {
  async remember(key: MemoryKey, content: string): Promise<MemoryEntry> {
    const createdAt = new Date().toISOString();
    if (key.scope === 'short_term') {
      const id = `mem_${Date.now().toString(36)}`;
      const entries = readShortTerm(key.namespace);
      writeShortTerm(key.namespace, [...entries, { id, turnSummary: content, timestamp: createdAt }]);
      return { id, content, createdAt };
    }

    const id = `fact_${Date.now().toString(36)}`;
    const facts = readLongTerm();
    writeLongTerm([...facts, { id, category: key.namespace, text: content, createdAt }]);
    return { id, content, createdAt };
  }

  async recall(key: MemoryKey, limit?: number): Promise<MemoryEntry[]> {
    if (key.scope === 'short_term') {
      const entries = readShortTerm(key.namespace).map(toMemoryEntry);
      return limit === undefined ? entries : entries.slice(-limit);
    }

    const facts = readLongTerm()
      .filter((fact) => fact.category === key.namespace)
      .map(toMemoryEntry);
    return limit === undefined ? facts : facts.slice(-limit);
  }

  async search(scope: MemoryScope, query: string): Promise<MemoryEntry[]> {
    if (scope === 'short_term') {
      return KNOWN_SHORT_TERM_NAMESPACES.flatMap((namespace) => readShortTerm(namespace).map(toMemoryEntry)).filter((entry) =>
        matchesQuery(entry.content, query)
      );
    }

    return readLongTerm()
      .map(toMemoryEntry)
      .filter((entry) => matchesQuery(entry.content, query));
  }

  async clear(key: MemoryKey): Promise<void> {
    if (key.scope === 'short_term') {
      writeShortTerm(key.namespace, []);
      return;
    }
    writeLongTerm(readLongTerm().filter((fact) => fact.category !== key.namespace));
  }
}
