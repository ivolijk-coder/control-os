import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';
import { createFinancialContract, FinancialContractError, listFinancialContracts } from '@/services/finance-contracts';
import type { FinancialContractOrigin, FinancialContractSource, FinancialContractType } from '@/services/finance-contracts';

/**
 * `GET/POST /api/finance/contracts` — evolução "Parcelas & Empréstimos".
 * Mesmo padrão de `app/api/finance/transactions/route.ts`: origem sempre
 * `currentSessionUserId()`, nunca informada pelo cliente.
 */

const TYPES: readonly FinancialContractType[] = ['LOAN', 'FINANCING', 'CARD_INSTALLMENT', 'SUPPLIER'];
const ORIGINS: readonly FinancialContractOrigin[] = ['PERSONAL', 'COMPANY'];
const SOURCES: readonly FinancialContractSource[] = ['MANUAL', 'NOVA', 'DOCUMENT'];

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}
function failure(message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, message }, { status });
}
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function date(value: unknown): string | undefined {
  return value === undefined ? undefined : typeof value === 'string' && !Number.isNaN(new Date(value).getTime()) ? value : undefined;
}
function member<T extends string>(value: unknown, values: readonly T[]): T | undefined {
  return typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : undefined;
}

export async function GET(): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return failure('Faça login para consultar os contratos.', 401);

  try {
    const contracts = await listFinancialContracts(userId);
    return NextResponse.json({ success: true, contracts });
  } catch (cause) {
    console.error('Falha ao listar contratos financeiros:', cause);
    return failure('Não foi possível carregar os contratos agora.', 500);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return failure('Faça login para cadastrar um contrato.', 401);

  const body = object(await request.json().catch(() => undefined));
  if (!body) return failure('Informe os dados do contrato.', 400);

  const name = text(body.name);
  if (!name) return failure('Informe o nome do contrato.', 400);
  const type = member(body.type, TYPES);
  if (!type) return failure('Informe um tipo de contrato válido (empréstimo, financiamento, cartão parcelado ou fornecedor).', 400);
  const totalAmount = num(body.totalAmount);
  if (totalAmount === undefined || totalAmount <= 0) return failure('Informe o valor total do contrato.', 400);
  const totalInstallments = num(body.totalInstallments);
  if (totalInstallments === undefined || totalInstallments < 1 || !Number.isInteger(totalInstallments)) return failure('Informe o número de parcelas.', 400);
  const dueDay = num(body.dueDay);
  if (dueDay === undefined || dueDay < 1 || dueDay > 31 || !Number.isInteger(dueDay)) return failure('Informe o dia de vencimento (1 a 31).', 400);
  const startDate = date(body.startDate);
  if (body.startDate !== undefined && !startDate) return failure('A data de início informada é inválida.', 400);
  const endDate = date(body.endDate);
  if (body.endDate !== undefined && !endDate) return failure('A data de término informada é inválida.', 400);
  const origin = body.origin === undefined ? undefined : member(body.origin, ORIGINS);
  if (body.origin !== undefined && !origin) return failure('Origem do contrato inválida.', 400);
  const source = body.source === undefined ? undefined : member(body.source, SOURCES);
  if (body.source !== undefined && !source) return failure('Origem de criação do contrato inválida.', 400);

  try {
    const contract = await runAsFinanceUser(userId, () =>
      createFinancialContract({
        userId,
        name,
        institution: text(body.institution),
        type,
        origin,
        categoryId: text(body.categoryId),
        accountId: text(body.accountId),
        totalAmount,
        financedAmount: num(body.financedAmount),
        totalInstallments,
        installmentAmount: num(body.installmentAmount),
        dueDay,
        startDate,
        endDate,
        interestRate: num(body.interestRate),
        source,
        documentId: text(body.documentId),
      })
    );
    return NextResponse.json({ success: true, contract }, { status: 201 });
  } catch (cause) {
    if (cause instanceof FinancialContractError) return failure(cause.message, cause.status);
    console.error('Falha ao criar contrato financeiro:', cause);
    return failure('Não foi possível criar o contrato agora.', 500);
  }
}
