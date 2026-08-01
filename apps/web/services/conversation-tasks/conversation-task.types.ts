/**
 * `ConversationTask` — infraestrutura genérica de interações proativas da
 * NOVA (evolução "NOVA como centro da experiência"). Documento analisado
 * é o primeiro produtor; email recebido, fatura vencida, PIX recebido,
 * conta atrasada, viagem próxima, meta atingida e eventos de Open Finance
 * são produtores futuros do MESMO formato — nenhum deles exige mudança
 * neste arquivo além de estender `ConversationTaskType`.
 *
 * "A NOVA só conversa consumindo ConversationTasks": nada aqui conhece
 * `DocumentImportProposal`, `contract-analysis.ts` ou qualquer conceito do
 * módulo Documentos — isso vive só no produtor (Fase C) e no handler que
 * resolve a ação (Fase E).
 */

export type ConversationTaskType = 'DOCUMENT_ANALYSIS_COMPLETED';
// Ao adicionar um novo produtor (ex.: 'EMAIL_RECEIVED', 'INVOICE_DUE',
// 'PIX_RECEIVED', 'BILL_OVERDUE', 'TRIP_UPCOMING', 'GOAL_ACHIEVED',
// 'OPEN_FINANCE_EVENT'), estenda esta union — o `tsc` acusa em compile
// time qualquer `switch` exaustivo (ex.: handler registry da Fase E) que
// esqueceu de tratar o tipo novo. Nunca vira uma migration nova: `type` é
// `String` no Postgres (ver schema.prisma).

export type ConversationTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'WAITING_USER' | 'COMPLETED' | 'DISMISSED' | 'FAILED';

export type ConversationTaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/**
 * Botão de ação genérico. `id` é o identificador que o handler registry
 * (Fase E) usa para decidir o que fazer — nunca um enum fixo, porque cada
 * `ConversationTaskType` define seu próprio vocabulário de ações (ex.:
 * "cadastrar_financiamento"/"guardar_documento"/"depois" para documentos;
 * tipos futuros terão o seu). A UI (`nova-message-bubble.tsx`, Fase D)
 * apenas renderiza `label` e devolve `id` — não sabe nem precisa saber o
 * que cada ação significa.
 */
export type ConversationTaskAction = {
  id: string;
  label: string;
};

export type ConversationTask = {
  id: string;
  userId: string;
  type: ConversationTaskType;
  status: ConversationTaskStatus;
  priority: ConversationTaskPriority;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  actions: ConversationTaskAction[];
  sourceType: string;
  sourceId: string;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  dismissedAt: Date | null;
};
