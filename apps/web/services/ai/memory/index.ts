import { getNovaState, recallFacts } from '@/services/nova';

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

/**
 * Memory Engine (CONTROL OS — Etapa 7: IA-Native). "Ainda sem banco
 * vetorial. Apenas estrutura... Ela nunca depende apenas do histórico do
 * chat." — diferente das interfaces acima (que descrevem uma implementação
 * FUTURA, ainda não construída), `UserMemoryProfile`/`buildUserMemoryProfile`
 * são reais e funcionam hoje: montados sobre a memória durável que já
 * existe (`NovaFact`, em `services/nova/memory` — `localStorage`, sobrevive
 * entre sessões) e sobre o NOVA State (`services/nova/state` — atualizado
 * continuamente pelo `NovaObserver`, nunca só quando o usuário conversa).
 * `currentContext` é o único campo que não vem de `NovaFact` — vem do
 * último evento observado, porque "contexto atual" é inerentemente algo que
 * muda a cada ação do sistema, não um fato estável sobre o usuário.
 */
export interface UserMemoryProfile {
  mainGoal: string | undefined;
  preferences: string[];
  priorities: string[];
  responseStyle: string | undefined;
  routineSummary: string | undefined;
  currentContext: string | undefined;
}

export function buildUserMemoryProfile(): UserMemoryProfile {
  const [mainGoal] = recallFacts('objetivo_principal').map((fact) => fact.text);
  const [responseStyle] = recallFacts('estilo_resposta').map((fact) => fact.text);
  const [routineSummary] = recallFacts('rotina').map((fact) => fact.text);
  return {
    mainGoal,
    preferences: recallFacts('preferencia').map((fact) => fact.text),
    priorities: recallFacts('prioridade').map((fact) => fact.text),
    responseStyle,
    routineSummary,
    currentContext: getNovaState().lastEventSummary,
  };
}
