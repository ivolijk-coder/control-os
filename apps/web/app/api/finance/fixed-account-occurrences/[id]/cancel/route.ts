import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { financeService } from '@/services/modules';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';
export async function POST(_request: Request, { params }: { params: { id: string } }) { const userId = currentSessionUserId(); if (!userId) return NextResponse.json({ success: false, message: 'Faça login.' }, { status: 401 }); const result = await runAsFinanceUser(userId, () => financeService.cancelFixedAccountOccurrence(params.id)); return NextResponse.json(result, { status: result.success ? 200 : 400 }); }
