import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentSessionUserId } from '@/services/auth/session';
import { downloadPrivateFile } from '@/services/documents/openai-files';

export async function GET(_request: Request, { params }: { params: { id: string } }): Promise<Response> {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ success: false, message: 'Faça login para baixar seus arquivos.' }, { status: 401 });
  const document = await prisma.storedDocument.findFirst({ where: { id: params.id, userId, archivedAt: null } });
  if (!document) return NextResponse.json({ success: false, message: 'Arquivo não encontrado.' }, { status: 404 });
  try {
    const upstream = await downloadPrivateFile(document.openaiFileId);
    return new Response(upstream.body, {
      headers: {
        'Content-Type': document.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(document.originalFileName)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível baixar o arquivo agora.';
    return NextResponse.json({ success: false, message }, { status: 502 });
  }
}
