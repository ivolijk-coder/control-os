import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { publicDocumentFailure } from '@/services/documents/document-core';
import { listDocuments, uploadDocument } from '@/services/documents/persistent-document.service';

export async function GET(request: Request) {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ success: false, message: 'Faça login para acessar seus arquivos.' }, { status: 401 });
  const search = new URL(request.url).searchParams;
  try {
    return NextResponse.json({ success: true, ...(await listDocuments(userId, {
      q: search.get('q') ?? undefined,
      cursor: search.get('cursor') ?? undefined,
      includeArchived: search.get('archived') === 'true',
      kind: search.get('kind') === 'CONTRACT' ? 'CONTRACT' : search.get('kind') === 'GENERAL' ? 'GENERAL' : undefined,
      folder: search.get('folder') ?? undefined,
      tag: search.get('tag') ?? undefined,
      analysisStatus: search.get('analysisStatus') ?? undefined,
    })) });
  } catch (error) {
    const failure = publicDocumentFailure(error, 'Não foi possível consultar seus documentos agora.');
    return NextResponse.json({ success: false, code: failure.code, message: failure.message }, { status: failure.status });
  }
}

export async function POST(request: Request) {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ success: false, message: 'Faça login para guardar arquivos.' }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ success: false, message: 'Escolha um arquivo para enviar.' }, { status: 400 });
    const result = await uploadDocument(userId, file, typeof form.get('title') === 'string' ? String(form.get('title')) : undefined);
    return NextResponse.json({ success: true, ...result }, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    const failure = publicDocumentFailure(error, 'Não foi possível guardar o arquivo agora.');
    return NextResponse.json({ success: false, code: failure.code, message: failure.message }, { status: failure.status });
  }
}
