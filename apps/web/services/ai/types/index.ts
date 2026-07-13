import type {
  AgendaEvent,
  Asset,
  Debt,
  FinanceEntry,
  Habit,
  Mission,
  Note,
  PersonalDocument,
  Trip,
} from '@control-os/types';
import type { AIProviderErrorCode } from '../errors';

/**
 * Tipos da camada de IA (CONTROL OS — Preparação para OpenAI GPT-5.5).
 *
 * Nenhum tipo aqui faz chamada HTTP, usa API key ou gera custo por si só —
 * são os contratos que tanto o `MockAIProvider` (determinístico) quanto o
 * `OpenAIProvider` (real, desde a Etapa 4, via `app/api/ai/nova/route.ts`)
 * precisam satisfazer. Reaproveita os tipos de domínio existentes
 * (`@control-os/types`) em vez de duplicá-los.
 */

/** Um provedor por vez — qual, é decidido em `services/ai/config.ts`. */
export type AIProviderName = 'mock' | 'openai';

/** Uma mensagem de uma conversa, no formato genérico que qualquer LLM de chat espera. */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Snapshot somente-leitura passado ao `AIProvider` a cada turno — o mesmo
 * princípio já usado em `NovaContext` (services/nova/interfaces): quem
 * escreve dados é sempre a camada de Actions, nunca a IA. `AIConversationContext`
 * é o subconjunto de `NovaContext` que faz sentido para classificar/gerar
 * texto — sem `actions`, porque a IA nunca deve ter acesso direto ao que
 * grava no banco.
 */
export interface AIConversationContext {
  userName: string;
  debts: Debt[];
  missions: Mission[];
  agendaEvents: AgendaEvent[];
  financeEntries: FinanceEntry[];
  habits: Habit[];
  /**
   * Adicionados na Etapa 4 (Preparação profissional para OpenAI GPT-5.5) —
   * cobertura completa dos domínios do CONTROL OS no contexto enviado a um
   * provedor real. `preferences` vem de `recallFacts('preferencia')`
   * (memória de longo prazo já existente em `services/nova/memory`) — não
   * duplica dado nenhum, só projeta o texto de cada fato.
   */
  trips: Trip[];
  documents: PersonalDocument[];
  assets: Asset[];
  notes: Note[];
  preferences: string[];
}

/**
 * Entidades genéricas que um provedor consegue extrair de um texto livre.
 * Todos os campos são opcionais — nem toda mensagem tem valor, data, horário
 * etc. Formato concreto (sem `any`/`unknown`) para o método `extractEntities`
 * do `AIProvider`.
 */
export interface AIExtractedEntities {
  amount?: number;
  date?: string;
  time?: string;
  title?: string;
  category?: string;
}

/**
 * Contrato entre `OpenAIProvider` (client, `services/ai/providers/`) e a
 * Route Handler server-only (`app/api/ai/nova/route.ts`) — CONTROL OS,
 * Etapa 4. O `OpenAIProvider` NUNCA fala com a OpenAI diretamente; ele só
 * conhece este contrato HTTP local (mesma origem, sem CORS, sem expor a
 * API key ao navegador).
 */
export type NovaAIRequestMode = 'chat' | 'generate' | 'classify' | 'extract' | 'summarize' | 'suggest';

export interface NovaAIRequestBody {
  mode: NovaAIRequestMode;
  /** Usado no modo `'chat'` — histórico completo. */
  messages?: ChatMessage[];
  /** Usado nos demais modos — texto único (mensagem do usuário, ou texto a resumir). */
  prompt?: string;
  /** Resumo compacto de `AIConversationContext` — ver `services/ai/context/buildModelContext.ts`. */
  contextSummary?: string;
}

/** Argumentos de uma tool call — sempre string ou number nas Tools atuais (ver `services/ai/tools/schemas.ts`). */
export interface NovaAIToolCall {
  name: string;
  arguments: Record<string, string | number>;
}

export type NovaAIResponseBody =
  | { ok: true; content: string; toolCall?: NovaAIToolCall }
  | { ok: false; code: AIProviderErrorCode; message: string };
