import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { currentSessionUserId } from '@/services/auth/session';
import { auditDocument } from '@/services/documents/document-core';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const userId = currentSessionUserId(); if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  const proposal = await prisma.documentImportProposal.findFirst({ where: { id: params.id, userId } }); if (!proposal) return NextResponse.json({ error: 'Prévia não encontrada.' }, { status: 404 });
  if (!['PENDING', 'READY_FOR_REVIEW'].includes(proposal.status)) return NextResponse.json({ error: 'Esta prévia não pode mais ser editada.' }, { status: 409 });
  const body = await request.json().catch(() => null); if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  const updated = await prisma.documentImportProposal.update({ where: { id: proposal.id }, data: { extractedData: body as Prisma.InputJsonValue, status: 'READY_FOR_REVIEW' } });
  await auditDocument({ userId, documentId: proposal.documentId, proposalId: proposal.id, operation: 'PREVIEW_UPDATED', source: 'manual', entityType: 'document_preview', entityId: proposal.id, before: proposal.extractedData, after: body });
  return NextResponse.json({ success: true, preview: updated });
}
