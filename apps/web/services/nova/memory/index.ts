/**
 * Memória da Nova (CONTROL OS 3.0) — arquitetura mínima, sem IA real ainda.
 *
 * Guarda um resumo curto de cada turno de conversa em `sessionStorage`,
 * para que a Nova eventualmente possa consultar rotina/preferências/metas
 * recentes ao formular respostas. Fase atual: apenas grava e permite
 * recuperar os últimos turnos — nenhum resumo automático ou embedding
 * ainda. Guardado por `sessionStorage` (não `localStorage`) porque memória
 * de curto prazo por sessão é suficiente nesta fase; migrar para
 * persistência de longo prazo é uma decisão de fase futura.
 */

export interface NovaMemoryEntry {
  id: string;
  turnSummary: string;
  timestamp: string;
}

const STORAGE_KEY = 'control-os-nova-memory';
const MAX_ENTRIES = 20;

function isNovaMemoryEntry(value: unknown): value is NovaMemoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  if (!('id' in value) || !('turnSummary' in value) || !('timestamp' in value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.turnSummary === 'string' &&
    typeof value.timestamp === 'string'
  );
}

function readAll(): NovaMemoryEntry[] {
  if (typeof window === 'undefined') return [];
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isNovaMemoryEntry);
  } catch {
    return [];
  }
}

function writeAll(entries: NovaMemoryEntry[]): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
}

export function rememberTurn(turnSummary: string): void {
  const entries = readAll();
  const entry: NovaMemoryEntry = {
    id: `mem_${Date.now().toString(36)}`,
    turnSummary,
    timestamp: new Date().toISOString(),
  };
  writeAll([...entries, entry]);
}

export function recallRecent(limit = 5): NovaMemoryEntry[] {
  return readAll().slice(-limit);
}

/**
 * Memória estruturada (CONTROL OS — Sistema Operacional Pessoal):
 * preferências, família e rotina — diferente de `NovaMemoryEntry` (resumo
 * bruto de cada turno, curto prazo, `sessionStorage`), um `NovaFact` é uma
 * informação durável sobre o usuário ("prefere ser chamado de Ivoli",
 * "tem uma filha, a Ana", "malha às terças e quintas"). Guardado em
 * `localStorage` (não `sessionStorage`) porque, diferente do resumo de
 * conversa, isso precisa sobreviver entre sessões — é o que torna a Nova
 * "com memória própria", não só um parser sem estado.
 *
 * Nesta fase ainda não há extração automática de fatos a partir da
 * conversa (isso depende de IA real, fora do escopo) — a API já existe e
 * funciona (`rememberFact`/`recallFacts`), pronta para um LLM real chamar
 * no futuro; por enquanto os fatos vêm de um seed inicial (ver
 * `SEED_FACTS`), demonstrando o formato.
 */
export type NovaFactCategory = 'preferencia' | 'familia' | 'rotina';

export interface NovaFact {
  id: string;
  category: NovaFactCategory;
  text: string;
  createdAt: string;
}

const FACTS_STORAGE_KEY = 'control-os-nova-facts';
const MAX_FACTS = 100;

const SEED_FACTS: readonly Omit<NovaFact, 'id' | 'createdAt'>[] = [
  { category: 'preferencia', text: 'Prefere respostas diretas, sem enrolação.' },
  { category: 'rotina', text: 'Costuma revisar o Financeiro toda segunda de manhã.' },
];

function isNovaFactCategory(value: unknown): value is NovaFactCategory {
  return value === 'preferencia' || value === 'familia' || value === 'rotina';
}

function isNovaFact(value: unknown): value is NovaFact {
  if (typeof value !== 'object' || value === null) return false;
  if (!('id' in value) || !('category' in value) || !('text' in value) || !('createdAt' in value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    isNovaFactCategory(value.category) &&
    typeof value.text === 'string' &&
    typeof value.createdAt === 'string'
  );
}

function readAllFacts(): NovaFact[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(FACTS_STORAGE_KEY);
  if (!raw) {
    // Primeira carga: semeia com os fatos de exemplo, pra `recallFacts` não
    // começar vazio — mesma ideia dos outros módulos desta etapa (dados
    // mockados realistas, nunca uma tela em branco).
    const seeded = SEED_FACTS.map((fact, index) => ({
      ...fact,
      id: `fact_seed_${index}`,
      createdAt: new Date().toISOString(),
    }));
    writeAllFacts(seeded);
    return seeded;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isNovaFact);
  } catch {
    return [];
  }
}

function writeAllFacts(facts: NovaFact[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FACTS_STORAGE_KEY, JSON.stringify(facts.slice(-MAX_FACTS)));
}

export function rememberFact(category: NovaFactCategory, text: string): NovaFact {
  const facts = readAllFacts();
  const fact: NovaFact = {
    id: `fact_${Date.now().toString(36)}`,
    category,
    text,
    createdAt: new Date().toISOString(),
  };
  writeAllFacts([...facts, fact]);
  return fact;
}

export function recallFacts(category?: NovaFactCategory): NovaFact[] {
  const facts = readAllFacts();
  return category ? facts.filter((fact) => fact.category === category) : facts;
}
