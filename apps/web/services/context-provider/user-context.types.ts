export const CONTEXT_COVERAGE_STATUSES = ['AVAILABLE', 'NOT_IMPLEMENTED', 'UNAVAILABLE'] as const;
export type ContextCoverageStatus = (typeof CONTEXT_COVERAGE_STATUSES)[number];

export const USER_CONTEXT_DOMAINS = [
  'PROFILE',
  'FINANCE',
  'DOCUMENTS',
  'OPERATIONAL_TASKS',
  'AGENDA',
  'GOALS',
  'PROJECTS',
  'MISSIONS',
  'HABITS',
  'TRIPS',
  'ASSETS',
  'NOTES',
  'CARDS',
] as const;
export type UserContextDomain = (typeof USER_CONTEXT_DOMAINS)[number];

export interface ContextCoverageDTO {
  domain: UserContextDomain;
  status: ContextCoverageStatus;
}

/** Perfil mínimo obtido exclusivamente da conta autenticada. */
export interface UserProfile {
  id: string;
  name: string;
}

/** Somente metadados agregados; conteúdo e nomes de documentos não entram no prompt. */
export interface DocumentsContext {
  total: number;
  pendingAnalysis: number;
  failedAnalysis: number;
}

/** Tarefas reais criadas pelo pipeline operacional/documental. */
export interface OperationalTasksContext {
  pending: number;
  waitingUser: number;
}

export interface RuntimeContext {
  referenceDate: string;
  generatedAt: string;
  timezone: string;
}

/**
 * Contexto factual seguro. Fontes sem persistência não possuem listas vazias
 * ambíguas: sua ausência é declarada em `coverage`.
 */
export interface UserContext {
  profile: UserProfile | null;
  documents: DocumentsContext | null;
  operationalTasks: OperationalTasksContext | null;
  runtime: RuntimeContext;
  coverage: ContextCoverageDTO[];
}

export function buildUserContextCoverage(
  values: Partial<Record<UserContextDomain, ContextCoverageStatus>>
): ContextCoverageDTO[] {
  return USER_CONTEXT_DOMAINS.map((domain) => ({
    domain,
    status: values[domain] ?? 'NOT_IMPLEMENTED',
  }));
}
