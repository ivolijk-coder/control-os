import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { financeService } from '@/services/modules';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';
export async function POST(request: Request, { params }: { params: { id: string } }) { const userId = currentSessionUserId(); if (!userId) return NextResponse.json({ success: false, message: 'Faça login.' }, { status: 401 }); const body = await request.json().catch(() => ({})) as { amount?: unknown }; const result = await runAsFinanceUser(userId, () => financeService.payFixedAccountOccurrence({ id: params.id, amount: typeof body.amount === 'number' ? body.amount : undefined, idempotencyKey: request.headers.get('idempotency-key') ?? undefined, source: 'manual' })); return NextResponse.json(result, { status: result.success ? 200 : 400 }); }
