import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentSessionUserId } from '@/services/auth/session';
import { auditDocument } from '@/services/documents/document-core';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const userId = await currentSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  const document = await prisma.storedDocument.findFirst({ where: { id: params.id, userId }, include: { importProposals: { orderBy: { createdAt: 'desc' } } } });
  return document ? NextResponse.json({ success: true, document }) : NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const userId = await currentSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  const body = await request.json().catch(() => null) as { title?: unknown; displayName?: unknown; folder?: unknown; tags?: unknown } | null;
  if (!body) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  const stringValue = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : undefined;
  const tags = body.tags === undefined ? undefined : Array.isArray(body.tags) ? [...new Set(body.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim().slice(0, 40)).filter(Boolean))].slice(0, 20) : undefined;
  if (body.tags !== undefined && !tags) return NextResponse.json({ error: 'Tags inválidas.' }, { status: 400 });
  const current = await prisma.storedDocument.findFirst({ where: { id: params.id, userId } });
  if (!current) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
  const title = stringValue(body.title, 160);
  const displayName = stringValue(body.displayName, 160);
  const folder = stringValue(body.folder, 100);
  if (body.title !== undefined && !title) return NextResponse.json({ error: 'Título inválido.' }, { status: 400 });
  const document = await prisma.storedDocument.update({ where: { id: current.id }, data: { ...(title !== undefined ? { title } : {}), ...(displayName !== undefined ? { displayName } : {}), ...(folder !== undefined ? { folder: folder || null } : {}), ...(tags !== undefined ? { tags } : {}) } });
  await auditDocument({ userId, documentId: document.id, operation: 'DOCUMENT_UPDATED', source: 'manual', entityType: 'document', entityId: document.id, before: { title: current.title, displayName: current.displayName, folder: current.folder, tags: current.tags }, after: { title: document.title, displayName: document.displayName, folder: document.folder, tags: document.tags } });
  return NextResponse.json({ success: true, document });
}
