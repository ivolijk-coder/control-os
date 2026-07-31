import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { publicDocumentFailure } from '@/services/documents/document-core';
import { openDocument } from '@/services/documents/persistent-document.service';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ success: false, message: 'Faça login para baixar documentos.' }, { status: 401 });
  try {
    const result = await openDocument(userId, params.id);
    if (!result) return NextResponse.json({ success: false, message: 'Documento não encontrado.' }, { status: 404 });
    return new NextResponse(Uint8Array.from(result.content).buffer, { headers: { 'content-type': result.document.detectedMimeType || result.document.mimeType, 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.document.originalFileName)}`, 'cache-control': 'private, no-store' } });
  } catch (error) {
    const failure = publicDocumentFailure(error, 'Não foi possível abrir o documento.');
    return NextResponse.json({ success: false, code: failure.code, message: failure.message }, { status: failure.status });
  }
}
