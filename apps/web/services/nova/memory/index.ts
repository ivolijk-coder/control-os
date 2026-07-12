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
