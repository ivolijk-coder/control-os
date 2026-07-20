/**
 * Ponto único de importação dos Module Services (CONTROL HUB — Fase 4:
 * Action Engine real). Consumidores (as Actions em
 * `services/action-engine/actions/`, e testes) importam só daqui — nunca de
 * `finance/finance.service.ts` etc. diretamente. Mesma convenção de
 * `services/control-hub/index.ts`, `services/context-provider/index.ts` e
 * `services/memory/index.ts`.
 *
 * "Nesta etapa utilizar apenas mocks. Não conectar banco de dados ainda." —
 * cada `Mock*Service` guarda seus registros num array na memória do
 * processo (ver cada arquivo `*.service.ts` para a justificativa completa).
 * Quando um banco de dados real chegar, cada Service ganha uma nova
 * implementação (`Postgres*Service` etc.) — as Actions que os consomem, o
 * Action Registry e o Decision Engine não mudam uma linha, porque dependem
 * só das interfaces (`FinanceService`, `CalendarService`...), nunca de
 * `Mock*Service` diretamente.
 */
export { MockCalendarService, calendarService } from './calendar/calendar.service';
export type { CalendarService } from './calendar/calendar.interfaces';
export type { CreateEventInput, DeleteEventInput, UpdateEventInput } from './calendar/calendar.types';

/**
 * CONTROL OS — Fase 6: Persistência real. `PersistentFinanceService`
 * substitui completamente o antigo `MockFinanceService` (array em
 * memória) — depende de `FinanceRepository`/`PrismaFinanceRepository`
 * (`services/repositories`), nunca de `@prisma/client` diretamente.
 *
 * O singleton de produção (`financeService`) é montado AQUI, não dentro de
 * `finance.service.ts` — esta é a única linha de todo o módulo Finance que
 * importa o valor concreto `financeRepository` (`@/services/repositories`,
 * que é quem de fato instancia `PrismaFinanceRepository`). Separar "a
 * classe" de "qual repositório concreto ela usa em produção" é o que
 * permite testar `PersistentFinanceService` importando-a direto de
 * `finance.service.ts` (com `InMemoryFinanceRepository` injetado) sem
 * nunca tocar `@prisma/client` — ver `__tests__/finance.service.test.ts`.
 */
import { financeRepository } from '@/services/repositories';
import { PersistentFinanceService } from './finance/finance.service';
import type { FinanceService } from './finance/finance.interfaces';

export { PersistentFinanceService } from './finance/finance.service';
export const financeService: FinanceService = new PersistentFinanceService(financeRepository);
export type { FinanceService };
export type {
  CreateExpenseInput,
  CreateIncomeInput,
  DeleteExpenseInput,
  DeleteIncomeInput,
  FinanceSummary,
  UpdateExpenseInput,
  UpdateIncomeInput,
} from './finance/finance.types';

export { MockGoalsService, goalsService } from './goals/goals.service';
export type { GoalsService } from './goals/goals.interfaces';
export type { CreateMissionInput, UpdateGoalInput } from './goals/goals.types';

export { MockHabitsService, habitsService } from './habits/habits.service';
export type { HabitsService } from './habits/habits.interfaces';
export type { UpdateHabitInput } from './habits/habits.types';

export { MockNotesService, notesService } from './notes/notes.service';
export type { NotesService } from './notes/notes.interfaces';
export type { CreateNoteInput } from './notes/notes.types';

export { MockDocumentsService, documentsService } from './documents/documents.service';
export type { DocumentsService } from './documents/documents.interfaces';
export type { StoreDocumentInput } from './documents/documents.types';
