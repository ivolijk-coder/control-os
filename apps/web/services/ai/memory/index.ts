/**
 * Contratos de memória da camada de IA (CONTROL OS — Preparação para
 * OpenAI GPT-5.5). Apenas interfaces — sem implementação real ainda,
 * exatamente como pedido. A memória que já funciona hoje
 * (`services/nova/memory`: `rememberTurn`/`recallRecent`, `rememberFact`/
 * `recallFacts`) continua sendo o que a NOVA usa na prática; estas
 * interfaces são o contrato que uma implementação futura mais robusta
 * (histórico estruturado por sessão, contexto de usuário, busca semântica)
 * vai precisar satisfazer.
 */

export interface ChatMessageRecord {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/** Histórico de uma conversa (uma sessão) — sequência ordenada de mensagens. */
export interface ConversationHistory {
  sessionId: string;
  messages: ChatMessageRecord[];
}

/** Contexto durável sobre o usuário — nome, preferências simples chave-valor. */
export interface UserContext {
  userName: string;
  preferences?: Record<string, string>;
}

/** Persistência de histórico de conversa — hoje sem implementação real. */
export interface MemoryRepository {
  save(history: ConversationHistory): Promise<void>;
  load(sessionId: string): Promise<ConversationHistory | null>;
}

/**
 * Busca semântica (embeddings) sobre memórias/documentos do usuário — fase
 * futura, depende de um provedor de IA real. Interface só de intenção
 * arquitetural: nenhuma implementação (nem mock) ainda, porque não há
 * como simular embeddings de forma útil sem um modelo real.
 */
export interface FutureVectorStore {
  upsert(id: string, text: string, metadata: Record<string, string>): Promise<void>;
  query(text: string, topK: number): Promise<string[]>;
}

/** Fachada de memória que o `ConversationService` consumirá quando a implementação real existir. */
export interface MemoryService {
  remember(sessionId: string, message: ChatMessageRecord): Promise<void>;
  recall(sessionId: string): Promise<ChatMessageRecord[]>;
  getUserContext(): Promise<UserContext>;
}
