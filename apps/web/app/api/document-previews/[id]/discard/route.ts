import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentSessionUserId } from '@/services/auth/session';
import { auditDocument } from '@/services/documents/document-core';
export async function POST(_request: Request, { params }: { params: { id: string } }) {
 const userId = currentSessionUserId(); if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
 const preview = await prisma.documentImportProposal.findFirst({ where: { id: params.id, userId } }); if (!preview) return NextResponse.json({ error: 'Prévia não encontrada.' }, { status: 404 });
 if (preview.status === 'CONFIRMED') return NextResponse.json({ error: 'Uma prévia confirmada não pode ser descartada.' }, { status: 409 });
 const updated = await prisma.documentImportProposal.update({ where: { id: preview.id }, data: { status: 'DISCARDED', discardedAt: new Date() } });
 await auditDocument({ userId, documentId: preview.documentId, proposalId: preview.id, operation: 'PREVIEW_DISCARDED', source: 'manual', entityType: 'document_preview', entityId: preview.id }); return NextResponse.json({ success: true, preview: updated });
}
