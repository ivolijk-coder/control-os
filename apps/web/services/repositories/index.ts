/**
 * Ponto único de importação da camada de Repositories (CONTROL OS — Fase
 * 6: Persistência real). "O padrão definitivo de persistência que será
 * reutilizado por Agenda, Hábitos, Metas, Notas, Documentos, Patrimônio e
 * todos os módulos futuros" — cada módulo ganha seu próprio subdiretório
 * (`finance/`, `calendar/`, `goals/`, `habits/`, `notes/`, `documents/`),
 * mesma convenção de `services/modules/index.ts`.
 *
 * Só `finance/` tem implementação real nesta fase (`PrismaFinanceRepository`,
 * `InMemoryFinanceRepository`) — os outros cinco são só interface (stub),
 * "mesmo que apenas Finance seja implementado nesta fase".
 */
export { financeRepository, PrismaFinanceRepository, InMemoryFinanceRepository } from './finance';
export type {
  FinanceRepository,
  CreateFinanceAccountInput,
  CreateFinanceCategoryInput,
  CreateFinanceInstallmentInput,
  CreateFinanceTransactionInput,
  CreateFinanceTransferInput,
  FinanceAccountBalance,
  FinanceCategoryBreakdownItem,
  FinanceSummary,
  FinanceTransactionFilter,
  FinanceTransactionPage,
  FinanceTransactionPageQuery,
  UpdateFinanceTransactionInput,
} from './finance';

export type { CalendarRepository, CreateAgendaEventInput, UpdateAgendaEventInput } from './calendar/calendar-repository.interfaces';
export type { GoalsRepository, CreateMissionInput, UpdateMissionInput } from './goals/goals-repository.interfaces';
export type { HabitRepository, UpdateHabitRecordInput } from './habits/habit-repository.interfaces';
export type { NotesRepository, CreateNoteRecordInput } from './notes/notes-repository.interfaces';
export type { DocumentRepository, StoreDocumentRecordInput } from './documents/document-repository.interfaces';
