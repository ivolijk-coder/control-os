import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * O repositório financeiro é construído de dentro de transações externas em
 * três lugares (`document-proposal-confirmation.service.ts` e duas vezes em
 * `financial-contract.service.ts`), sempre recebendo o cliente transacional.
 *
 * Antes desta etapa ele recebia esse cliente e o IGNORAVA na maioria dos
 * métodos, indo direto no cliente global. Isso custava caro de duas formas:
 *
 * 1. O pool do Prisma neste container tem TRÊS conexões (`núcleos × 2 + 1`,
 *    com `cpus: "1.00"`). Uma transação aninhada segura uma segunda conexão
 *    enquanto a de fora ainda segura a primeira — dois fluxos simultâneos
 *    esgotavam o pool e o terceiro esperava até estourar. Isso não precisa de
 *    3000 usuários: precisa de dois.
 *
 * 2. Uma transação em outra conexão NÃO é atômica com a de fora. Se a de
 *    fora falhasse e voltasse atrás, o que este repositório tivesse gravado
 *    ficava gravado — contrariando o comentário do serviço que promete o
 *    contrário.
 *
 * Este teste falha se alguém reintroduzir o vazamento: com cliente
 * transacional em mãos, NENHUMA chamada pode chegar ao cliente global.
 */

const chamadasNoGlobal: string[] = [];

/** Espião que registra qualquer acesso a `prisma.<model>.<método>`. */
function clienteGlobalEspiao() {
  return new Proxy({} as Record<string, unknown>, {
    get(_alvo, model: string) {
      if (model === 'then') return undefined;
      if (model === '$transaction') {
        return (arg: unknown) => {
          chamadasNoGlobal.push('$transaction');
          if (typeof arg === 'function') {
            return (arg as (tx: unknown) => unknown)(clienteGlobalEspiao());
          }
          return Promise.resolve([]);
        };
      }
      return new Proxy({} as Record<string, unknown>, {
        get(_a, metodo: string) {
          return (...args: unknown[]) => {
            chamadasNoGlobal.push(`${model}.${metodo}`);
            return Promise.resolve(linhaFalsa(model, args));
          };
        },
      });
    },
  });
}

vi.mock('@/lib/prisma', () => ({ prisma: clienteGlobalEspiao() }));

/**
 * O repositório importa os enums do cliente gerado do Prisma. Este teste não
 * precisa deles de verdade — só dos nomes —, e mocká-los deixa o teste
 * hermético: roda sem banco e sem `prisma generate`, o que importa porque as
 * conferências acontecem em máquinas diferentes.
 */
vi.mock('@prisma/client', () => {
  const enumFalso = new Proxy({}, { get: (_a, chave: string) => chave.toUpperCase() });
  class DecimalFalso {
    constructor(private readonly valor: number | string) {}
    toNumber() { return Number(this.valor); }
    toString() { return String(this.valor); }
  }
  return {
    Prisma: { Decimal: DecimalFalso },
    AccountKind: enumFalso, AccountStatus: enumFalso, CategoryStatus: enumFalso,
    FixedAccountOccurrenceStatus: enumFalso, FixedAccountOrigin: enumFalso,
    FixedAccountPaymentMethod: enumFalso, FixedAccountRecurrence: enumFalso,
    TransactionOrigin: enumFalso, TransactionSource: enumFalso,
    TransactionStatus: enumFalso, TransactionType: enumFalso, TransferDirection: enumFalso,
  };
});

/** Linhas mínimas para os mapeadores do repositório não estourarem. */
function linhaFalsa(model: string, _args: unknown[]): unknown {
  const decimal = { toNumber: () => 10 };
  if (model === 'transaction') {
    return {
      id: 't1', type: 'EXPENSE', description: 'x', amount: decimal, category: 'Outros',
      categoryId: null, date: new Date(), accountId: null, transferGroupId: null,
      transferDirection: null, installmentGroupId: null, installmentNumber: null,
      installmentTotal: null, status: 'CONFIRMED', createdAt: new Date(), updatedAt: new Date(),
      idempotencyKey: null, source: 'manual', userId: 'u1',
    };
  }
  if (model === 'category') {
    return { id: 'c1', userId: 'u1', name: 'Casa', kind: 'EXPENSE', icon: null, color: null,
      sortOrder: 0, isFavorite: false, status: 'ACTIVE', archivedAt: null,
      createdAt: new Date(), updatedAt: new Date() };
  }
  if (model === 'account') {
    return { id: 'a1', userId: 'u1', name: 'Conta', type: 'CHECKING', institution: null,
      openingBalance: decimal, status: 'ACTIVE', archivedAt: null,
      createdAt: new Date(), updatedAt: new Date() };
  }
  return { id: 'x1' };
}

/** Cliente transacional falso: mesma superfície, mas registrado à parte. */
const chamadasNaTransacao: string[] = [];
function clienteTransacionalFalso() {
  return new Proxy({} as Record<string, unknown>, {
    get(_alvo, model: string) {
      if (model === 'then') return undefined;
      return new Proxy({} as Record<string, unknown>, {
        get(_a, metodo: string) {
          return (...args: unknown[]) => {
            chamadasNaTransacao.push(`${model}.${metodo}`);
            return Promise.resolve(linhaFalsa(model, args));
          };
        },
      });
    },
  });
}

describe('PrismaFinanceRepository dentro de uma transação externa', () => {
  beforeEach(() => {
    chamadasNoGlobal.length = 0;
    chamadasNaTransacao.length = 0;
  });

  it('não toca o cliente global em nenhuma escrita auditada', async () => {
    const { PrismaFinanceRepository } = await import('@/services/repositories/finance/prisma-finance.repository');
    const repo = new PrismaFinanceRepository(clienteTransacionalFalso() as any);

    await repo.createWithAudit('u1',
      { type: 'despesa', description: 'x', amount: 10, category: 'Outros', date: '2026-08-12' } as never,
      { source: 'manual', actorUserId: 'u1' } as never);
    await repo.createCategory('u1', { name: 'Casa', kind: 'despesa', source: 'manual' } as never);

    expect(chamadasNaTransacao.length).toBeGreaterThan(0);
    expect(chamadasNoGlobal).toEqual([]);
  });

  it('não abre uma segunda transação por dentro da de fora', async () => {
    const { PrismaFinanceRepository } = await import('@/services/repositories/finance/prisma-finance.repository');
    const repo = new PrismaFinanceRepository(clienteTransacionalFalso() as any);

    await repo.createWithAudit('u1',
      { type: 'despesa', description: 'x', amount: 10, category: 'Outros', date: '2026-08-12' } as never,
      { source: 'manual', actorUserId: 'u1' } as never);

    // É ISTO que esgotava o pool: cada `$transaction` aninhado ocupava uma
    // segunda conexão enquanto a de fora segurava a primeira.
    expect(chamadasNoGlobal).not.toContain('$transaction');
  });

  it('sem transação de fora, continua abrindo a sua própria', async () => {
    const { PrismaFinanceRepository } = await import('@/services/repositories/finance/prisma-finance.repository');
    const repo = new PrismaFinanceRepository();

    await repo.createWithAudit('u1',
      { type: 'despesa', description: 'x', amount: 10, category: 'Outros', date: '2026-08-12' } as never,
      { source: 'manual', actorUserId: 'u1' } as never);

    expect(chamadasNoGlobal).toContain('$transaction');
  });

  it('leituras avulsas também respeitam a transação de fora', async () => {
    const { PrismaFinanceRepository } = await import('@/services/repositories/finance/prisma-finance.repository');
    const repo = new PrismaFinanceRepository(clienteTransacionalFalso() as any);

    await repo.findCategoryByName('u1', 'Casa');
    await repo.findAccountById('u1', 'a1');

    expect(chamadasNoGlobal).toEqual([]);
    expect(chamadasNaTransacao).toContain('category.findFirst');
    expect(chamadasNaTransacao).toContain('account.findFirst');
  });
});
