import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentSessionUserId } from '@/services/auth/session';
import { uploadPrivateFile, validateDocument } from '@/services/documents/openai-files';

function titleFromName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Documento sem título';
}

/** Lista e recebe arquivos privados. A sessão, e nunca o navegador, define
 * de qual pessoa o arquivo é — inclusive no download posterior. */
export async function GET(request: Request): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ success: false, message: 'Faça login para acessar seus arquivos.' }, { status: 401 });
  const query = new URL(request.url).searchParams.get('q')?.trim();
  const documents = await prisma.storedDocument.findMany({
    where: { userId, archivedAt: null, ...(query ? { title: { contains: query, mode: 'insensitive' } } : {}) },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, title: true, originalFileName: true, mimeType: true, sizeBytes: true, kind: true, createdAt: true,
      importProposals: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, status: true, extractedData: true, createdAt: true },
      },
    },
  });
  return NextResponse.json({ success: true, documents });
}

export async function POST(request: Request): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ success: false, message: 'Faça login para guardar arquivos.' }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ success: false, message: 'Escolha um arquivo para enviar.' }, { status: 400 });
    validateDocument(file);
    const openaiFileId = await uploadPrivateFile(file);
    const requestedTitle = form.get('title');
    const title = typeof requestedTitle === 'string' && requestedTitle.trim() ? requestedTitle.trim().slice(0, 160) : titleFromName(file.name);
    const kind = file.type === 'application/pdf' ? 'CONTRACT' : 'GENERAL';
    const document = await prisma.storedDocument.create({
      data: { userId, title, originalFileName: file.name, mimeType: file.type, sizeBytes: file.size, openaiFileId, kind },
      select: { id: true, title: true, originalFileName: true, mimeType: true, sizeBytes: true, kind: true, createdAt: true },
    });
    return NextResponse.json({ success: true, document }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível guardar o arquivo agora.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
