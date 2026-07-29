import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentSessionUserId } from '@/services/auth/session';
export async function GET(_request: Request, { params }: { params: { id: string } }) {
 const userId = currentSessionUserId(); if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
 const previews = await prisma.documentImportProposal.findMany({ where: { userId, documentId: params.id }, orderBy: { createdAt: 'desc' } }); return NextResponse.json({ success: true, previews });
}
