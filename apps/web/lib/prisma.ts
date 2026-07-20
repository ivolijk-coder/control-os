import { PrismaClient } from '@prisma/client';

/**
 * CONTROL OS — Fase 6: Persistência real. Singleton do `PrismaClient" —
 * "o padrão definitivo de persistência que será reutilizado por Agenda,
 * Hábitos, Metas, Notas, Documentos, Patrimônio e todos os módulos
 * futuros": TODO `Prisma*Repository` futuro (`CalendarRepository`,
 * `GoalsRepository`...) importa esta MESMA instância — nunca cria seu
 * próprio `new PrismaClient()`. Isso é o que evita esgotar o pool de
 * conexões do Postgres com múltiplos clientes redundantes.
 *
 * Cache em `globalThis` em desenvolvimento — padrão oficial da própria
 * documentação do Prisma para Next.js: em dev, o Fast Refresh recarrega
 * módulos a cada mudança de arquivo, o que recriaria (e vazaria) uma nova
 * conexão a cada hot-reload sem este cache. Em produção (`NODE_ENV ===
 * 'production'`), cada processo cria sua própria instância normalmente —
 * não há hot-reload para vazar.
 *
 * Nenhum Module Service importa este arquivo diretamente — só
 * `Prisma*Repository` (`services/repositories/*`). "O Module Service nunca
 * deverá conversar diretamente com Prisma."
 */
declare global {
  // eslint-disable-next-line no-var -- padrão oficial do Prisma para cache em globalThis (precisa ser `var`, não `let`/`const`, para o hoisting de declaração global funcionar).
  var __controlOsPrismaClient: PrismaClient | undefined;
}

export const prisma: PrismaClient = globalThis.__controlOsPrismaClient ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__controlOsPrismaClient = prisma;
}
