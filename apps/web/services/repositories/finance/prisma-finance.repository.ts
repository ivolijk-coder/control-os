import { Prisma, TransactionType } from '@prisma/client';
import type { Transaction as PrismaTransactionRow } from '@prisma/client';
import type { FinanceEntry, FinanceEntryType } from '@control-os/types';
import { prisma } from '@/lib/prisma';
import type { FinanceRepository } from './finance-repository.interfaces';
import type {
  CreateFinanceTransactionInput,
  FinanceSummary,
  FinanceTransactionFilter,
  UpdateFinanceTransactionInput,
} from './finance-repository.types';

/**
 * `PrismaFinanceRepository` — CONTROL OS Fase 6 (Persistência real). "Ela
 * será a única classe que conhece Prisma." Nenhum outro arquivo de todo o
 * CONTROL OS importa `@prisma/client` ou `@/lib/prisma` além deste (e de
 * futuros `Prisma*Repository` irmãos, quando os outros módulos chegarem).
 *
 * IMPORTANTE — limite de verificação deste ambiente: este sandbox não tem
 * acesso à registry do npm (instalar `prisma`/`@prisma/client` não é
 * possível aqui) nem a um servidor PostgreSQL. Este arquivo foi escrito
 * seguindo exatamente as convenções documentadas e estáveis do Prisma
 * Client (nomes de model em camelCase — `Transaction` → `prisma.transaction`,
 * `Prisma.Decimal`/`Prisma.TransactionWhereInput` gerados a partir de
 * `schema.prisma`, `groupBy`/`aggregate` para consultas agregadas) — mas
 * NÃO pôde ser typechecked contra o client gerado de verdade, nem
 * executado contra um Postgres real, aqui. Rodar `pnpm install && pnpm
 * --filter @control-os/web db:generate && pnpm --filter @control-os/web
 * db:migrate` na máquina local é o que valida isto de ponta a ponta (ver
 * relatório desta fase). `InMemoryFinanceRepository` (mesmo diretório) é
 * quem valida toda a lógica de `FinanceService` de verdade nesta sandbox.
 *
 * Scoping por `userId`: `update`/`delete` fazem um `findFirst({id, userId})`
 * antes de mutar — não dá pra usar `where: {id, userId}` direto em
 * `update()`/`delete()` porque o Prisma exige que `where` de uma mutação
 * única use um campo (ou combinação) com constraint UNIQUE, e `(id,
 * userId)` não é uma unique key aqui (só `id` é); confirmar posse primeiro
 * evita tanto um erro de tipo quanto — mais importante — evita que um
 * `id` de outro usuário seja mutável só por adivinhação.
 */
export class PrismaFinanceRepository implements FinanceRepository {
  async create(userId: string, input: CreateFinanceTransactionInput): Promise<FinanceEntry> {
    const row = await prisma.transaction.create({
      data: {
        userId,
        type: toPersistedType(input.type),
        amount: new Prisma.Decimal(input.amount),
        description: input.description,
        category: input.category,
        date: input.date ? new Date(input.date) : undefined,
      },
    });
    return toFinanceEntry(row);
  }

  async update(userId: string, input: UpdateFinanceTransactionInput): Promise<FinanceEntry | undefined> {
    const existing = await prisma.transaction.findFirst({ where: { id: input.id, userId } });
    if (!existing) return undefined;

    const row = await prisma.transaction.update({
      where: { id: input.id },
      data: {
        amount: input.amount !== undefined ? new Prisma.Decimal(input.amount) : undefined,
        description: input.description,
        category: input.category,
        date: input.date !== undefined ? new Date(input.date) : undefined,
      },
    });
    return toFinanceEntry(row);
  }

  async delete(userId: string, id: string): Promise<FinanceEntry | undefined> {
    const existing = await prisma.transaction.findFirst({ where: { id, userId } });
    if (!existing) return undefined;

    const row = await prisma.transaction.delete({ where: { id } });
    return toFinanceEntry(row);
  }

  async findById(userId: string, id: string): Promise<FinanceEntry | undefined> {
    const row = await prisma.transaction.findFirst({ where: { id, userId } });
    return row ? toFinanceEntry(row) : undefined;
  }

  async list(userId: string, filter?: FinanceTransactionFilter): Promise<FinanceEntry[]> {
    const rows = await prisma.transaction.findMany({
      where: buildWhere(userId, filter),
      orderBy: { date: 'desc' },
    });
    return rows.map(toFinanceEntry);
  }

  /**
   * Agregação no banco (`groupBy`), não "buscar tudo e somar em JS" —
   * "Performance: evitar consultas desnecessárias... preparar a
   * arquitetura para crescimento." Continua correto (e barato) mesmo
   * quando um usuário tiver dezenas de milhares de lançamentos.
   */
  async getSummary(userId: string, filter?: FinanceTransactionFilter): Promise<FinanceSummary> {
    const rows = await prisma.transaction.groupBy({
      by: ['type'],
      where: buildWhere(userId, filter),
      _sum: { amount: true },
    });

    const totalIncome = rows.find((row) => row.type === TransactionType.INCOME)?._sum.amount?.toNumber() ?? 0;
    const totalExpenses = rows.find((row) => row.type === TransactionType.EXPENSE)?._sum.amount?.toNumber() ?? 0;
    return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses };
  }
}

function toPersistedType(type: FinanceEntryType): TransactionType {
  return type === 'receita' ? TransactionType.INCOME : TransactionType.EXPENSE;
}

function fromPersistedType(type: TransactionType): FinanceEntryType {
  return type === TransactionType.INCOME ? 'receita' : 'despesa';
}

function buildWhere(userId: string, filter?: FinanceTransactionFilter): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId };
  if (filter?.type) {
    where.type = toPersistedType(filter.type);
  }
  if (filter?.from || filter?.to) {
    where.date = {
      ...(filter.from ? { gte: new Date(filter.from) } : {}),
      ...(filter.to ? { lte: new Date(filter.to) } : {}),
    };
  }
  return where;
}

/** Borda do repositório: `Transaction` (Prisma, `Decimal`/`Date`/nulos) → `FinanceEntry` (domínio, `@control-os/types` — `number`/`string` ISO/sempre presente). Nenhuma camada acima desta função conhece a diferença. */
function toFinanceEntry(row: PrismaTransactionRow): FinanceEntry {
  return {
    id: row.id,
    type: fromPersistedType(row.type),
    description: row.description ?? '',
    amount: row.amount.toNumber(),
    category: row.category ?? 'Outros',
    date: row.date.toISOString(),
  };
}
