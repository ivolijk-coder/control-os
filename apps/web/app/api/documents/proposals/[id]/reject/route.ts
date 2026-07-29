import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentSessionUserId } from '@/services/auth/session';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const userId = await currentSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  const updated = await prisma.documentImportProposal.updateMany({
    where: { id: params.id, userId, status: 'PENDING' },
    data: { status: 'REJECTED', rejectedAt: new Date() },
  });
  if (!updated.count) return NextResponse.json({ error: 'Proposta não encontrada ou já encerrada.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
