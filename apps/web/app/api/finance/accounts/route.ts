import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { FinanceAccountKind } from '@control-os/types';
import { financeService } from '@/services/modules';
import { currentSessionUserId } from '@/services/auth/session';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';

function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, message }, { status });
}

function parseCents(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

const ACCOUNT_KINDS: readonly FinanceAccountKind[] = ['conta_corrente', 'poupanca', 'carteira', 'outro'];

function parseAccountKind(value: unknown): FinanceAccountKind | undefined {
  return typeof value === 'string' && ACCOUNT_KINDS.includes(value as FinanceAccountKind)
    ? (value as FinanceAccountKind)
    : undefined;
}

/** Superfície HTTP manual do módulo Contas Bancárias. A identidade é sempre
 * derivada da sessão; o navegador nunca escolhe o userId nem a origem. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return errorResponse('Faça login para consultar suas contas.', 401);

  const includeArchived = request.nextUrl.searchParams.get('includeArchived') === 'true';
  try {
    const payload = await runAsFinanceUser(userId, async () => {
      const [accounts, activeBalances] = await Promise.all([
        financeService.listAccounts({ includeArchived }),
        financeService.listAccountBalances(),
      ]);
      const balanceByAccount = new Map(activeBalances.map((account) => [account.accountId, account.balance]));

      // Normalmente as contas arquivadas não são retornadas. Quando o usuário
      // pede o histórico, consultamos somente as arquivadas que faltam — sem
      // transformar a listagem principal em uma consulta por conta.
      const archivedAccounts = accounts.filter((account) => account.status === 'arquivada');
      const archivedBalances = await Promise.all(archivedAccounts.map(async (account) => [account.id, await financeService.getAccountBalance(account.id)] as const));
      for (const [accountId, balance] of archivedBalances) balanceByAccount.set(accountId, balance);

      return { accounts: accounts.map((account) => ({ ...account, balance: balanceByAccount.get(account.id) ?? 0 })) };
    });
    return NextResponse.json({ success: true, ...payload });
  } catch (error) {
    console.error('Falha ao consultar contas bancárias:', error);
    return errorResponse('Não foi possível carregar suas contas agora.', 500);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return errorResponse('Faça login para criar uma conta.', 401);
  const body = asObject(await request.json().catch(() => undefined));
  if (!body || typeof body.name !== 'string') return errorResponse('Informe o nome da conta.', 400);
  const name = body.name;
  const initialBalanceCents = body.initialBalanceCents === undefined ? 0 : parseCents(body.initialBalanceCents);
  if (initialBalanceCents === undefined) return errorResponse('O saldo inicial deve ser enviado em centavos inteiros.', 400);
  const kind = body.kind === undefined ? undefined : parseAccountKind(body.kind);
  if (body.kind !== undefined && !kind) return errorResponse('Tipo de conta inválido.', 400);

  try {
    const result = await runAsFinanceUser(userId, () => financeService.createAccount({
      name,
      kind,
      currency: typeof body.currency === 'string' ? body.currency : undefined,
      initialBalanceCents,
      openingBalanceDate: typeof body.openingBalanceDate === 'string' ? body.openingBalanceDate : undefined,
      source: 'manual',
    }));
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    console.error('Falha ao criar conta bancária:', error);
    return errorResponse('Não foi possível criar a conta agora.', 500);
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return errorResponse('Faça login para alterar uma conta.', 401);
  const body = asObject(await request.json().catch(() => undefined));
  if (!body || typeof body.id !== 'string' || typeof body.action !== 'string') return errorResponse('Informe a conta e a ação.', 400);
  const accountId = body.id;
  const action = body.action;

  try {
    const result = await runAsFinanceUser(userId, async () => {
      if (action === 'update') {
        return financeService.updateAccount({
          id: accountId,
          name: typeof body.name === 'string' ? body.name : undefined,
          currency: typeof body.currency === 'string' ? body.currency : undefined,
          source: 'manual',
        });
      }
      if (action === 'archive') return financeService.archiveAccount(accountId, 'manual');
      if (action === 'restore') return financeService.restoreAccount(accountId, 'manual');
      return { success: false, message: 'Ação de conta inválida.' };
    });
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('Falha ao alterar conta bancária:', error);
    return errorResponse('Não foi possível alterar a conta agora.', 500);
  }
}
