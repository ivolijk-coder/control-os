import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { DocumentError } from '@/services/documents/document-core';
import { cancelDocumentAnalysis } from '@/services/documents/persistent-document.service';

/** Cancela somente trabalho ainda enfileirado; trabalho concluído é histórico. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const userId = await currentSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  try {
    const result = await cancelDocumentAnalysis(userId, params.id);
    if (!result) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
    return NextResponse.json({ ok: true, job: result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof DocumentError ? error.message : 'Não foi possível cancelar a análise.' }, { status: 409 });
  }
}
