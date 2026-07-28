import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { financeService } from '@/services/modules';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const userId = currentSessionUserId(); if (!userId) return NextResponse.json({ success: false, message: 'Faça login.' }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ success: false, message: 'Dados inválidos.' }, { status: 400 });
  const result = await runAsFinanceUser(userId, () => financeService.updateFixedAccount({ id: params.id, ...body, source: 'manual' } as never));
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
