import type { AgendaEvent, Asset, FinanceEntry, Habit, Mission, Note, NovaMessage, PersonalDocument } from '@control-os/types';

/**
 * CONTROL HUB — Fase 2: Context Provider.
 *
 * "A NOVA nunca mais deverá acessar Zustand, React ou qualquer estado do
 * frontend. Ela deverá receber apenas um objeto chamado UserContext."
 * Este arquivo define exatamente esse objeto e os tipos de cada módulo que
 * o compõem.
 *
 * Propositalmente NÃO importa nada de `apps/web/lib` (nem `mock-data.ts`,
 * nem `data-store.ts`) — só `@control-os/types` (um pacote, não um app) e
 * TypeScript puro. Isso é o que torna este módulo "extraction-ready": zero
 * dependência de React, Zustand ou de qualquer coisa específica do
 * Next.js/`apps/web` (ver análise completa no relatório desta fase sobre
 * `apps/web` vs. `apps/api` vs. `packages/core`).
 */

/**
 * Recorte mínimo de `User` (`@control-os/types`) que a NOVA de fato usa
 * (personalização de saudação/resposta). Deliberadamente mais estreito que
 * `User` inteiro (que carrega `email`, `plan`, `company`, `createdAt`...) —
 * "não criar campos desnecessários": o Context Provider expõe uma conta de
 * usuário, não o perfil de billing/conta inteiro.
 */
export interface UserProfile {
  id: string;
  name: string;
}

/**
 * Um tipo por módulo, todos reaproveitando os tipos de domínio já
 * existentes em `@control-os/types` — nenhuma forma de dado nova é
 * inventada aqui, só o "envelope de contexto" que os agrupa por área do
 * produto, no vocabulário que a arquitetura do Hub usa (`profile`,
 * `agenda`, `finance`, `goals`, `habits`, `assets`, `notes`, `documents`,
 * `recentConversations`).
 */
export type AgendaContext = AgendaEvent[];
export type FinanceContext = FinanceEntry[];
export type GoalsContext = Mission[];
export type HabitsContext = Habit[];
export type AssetsContext = Asset[];
export type NotesContext = Note[];
export type DocumentsContext = PersonalDocument[];
/** Reaproveita `NovaMessage` (`@control-os/types`) — mesmo formato já usado pelo AI Workspace, não um tipo de mensagem paralelo. */
export type ConversationContext = NovaMessage;

/**
 * O objeto único que a NOVA recebe. Só leitura — nenhum `actions`/setter
 * (mesmo princípio de `NovaReadOnlyContext` em `services/nova/interfaces`,
 * agora levado ao pé da letra: nem sequer existe uma versão "com escrita"
 * deste tipo). A capacidade de EXECUTAR ações (criar despesa, evento de
 * agenda etc.) não desaparece — ela migra para o Action Engine
 * (`services/control-hub/action-engine.types.ts`, ainda só interface),
 * que é quem vai, no futuro, transformar uma decisão em efeito real —
 * nunca o `UserContext` em si.
 */
export interface UserContext {
  profile: UserProfile;
  agenda: AgendaContext;
  finance: FinanceContext;
  goals: GoalsContext;
  habits: HabitsContext;
  assets: AssetsContext;
  notes: NotesContext;
  documents: DocumentsContext;
  recentConversations: ConversationContext[];
}
