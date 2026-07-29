import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { setDocumentArchived } from '@/services/documents/persistent-document.service';
export async function POST(_request: Request, { params }: { params: { id: string } }) {
 const userId = currentSessionUserId(); if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
 const document = await setDocumentArchived(userId, params.id, false); return document ? NextResponse.json({ success: true, document }) : NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
}
