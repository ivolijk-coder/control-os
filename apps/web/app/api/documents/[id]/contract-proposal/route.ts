import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { publicDocumentFailure } from '@/services/documents/document-core';
import { enqueueDocumentAnalysis } from '@/services/documents/persistent-document.service';

/** Compatibilidade: análise agora entra na fila; nunca bloqueia o upload. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ success: false, message: 'Faça login para analisar contratos.' }, { status: 401 });
  try {
    const job = await enqueueDocumentAnalysis(userId, params.id);
    if (!job) return NextResponse.json({ success: false, message: 'Contrato não encontrado.' }, { status: 404 });
    return NextResponse.json({ success: true, queued: true, job: { id: job.id, status: job.status } }, { status: 202 });
  } catch (error) {
    const failure = publicDocumentFailure(error, 'Não foi possível preparar a análise.');
    return NextResponse.json({ success: false, code: failure.code, message: failure.message }, { status: failure.status });
  }
}
