import type { AgendaEvent, Debt, FinanceEntry, Habit, Mission } from '@control-os/types';

/**
 * Tipos da camada de IA (CONTROL OS — Preparação para OpenAI GPT-5.5).
 *
 * Nada aqui faz chamada HTTP, usa API key ou gera custo — são apenas os
 * contratos que tanto o `MockAIProvider` (hoje, determinístico) quanto o
 * `OpenAIProvider` (futuro, ainda não implementado) precisam satisfazer.
 * Reaproveita os tipos de domínio existentes (`@control-os/types`) em vez de
 * duplicá-los.
 */

/** Um provedor por vez. `'mock'` é o único ativo nesta fase. */
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
