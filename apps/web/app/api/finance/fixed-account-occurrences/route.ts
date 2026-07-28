import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { financeService } from '@/services/modules';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';

export async function GET(request: NextRequest) {
  const userId = currentSessionUserId(); if (!userId) return NextResponse.json({ success: false, message: 'Faça login para consultar ocorrências.' }, { status: 401 });
  const status = request.nextUrl.searchParams.get('status') as 'pendente' | 'paga' | 'parcial' | 'cancelada' | 'atrasada' | null;
  const occurrences = await runAsFinanceUser(userId, () => financeService.listFixedAccountOccurrences({ competence: request.nextUrl.searchParams.get('competence') ?? undefined, status: status ?? undefined, fixedAccountId: request.nextUrl.searchParams.get('fixedAccountId') ?? undefined }));
  return NextResponse.json({ success: true, occurrences });
}
