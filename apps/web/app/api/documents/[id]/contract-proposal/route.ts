import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { currentSessionUserId } from '@/services/auth/session';
import { extractContract } from '@/services/documents/openai-files';

/** Lê contrato somente para montar uma prévia. Esta rota não toca em
 * transações, contas ou parcelamentos. */
export async function POST(_request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ success: false, message: 'Faça login para analisar contratos.' }, { status: 401 });
  const document = await prisma.storedDocument.findFirst({ where: { id: params.id, userId, archivedAt: null } });
  if (!document) return NextResponse.json({ success: false, message: 'Contrato não encontrado.' }, { status: 404 });
  if (document.mimeType !== 'application/pdf') return NextResponse.json({ success: false, message: 'Envie o contrato em PDF para gerar a prévia.' }, { status: 400 });

  // Repetir o envio ou atualizar a página não pode criar duas prévias para o
  // mesmo contrato. A pessoa continua livre para descartar e pedir nova leitura.
  const pendingProposal = await prisma.documentImportProposal.findFirst({
    where: { userId, documentId: document.id, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
  if (pendingProposal) {
    return NextResponse.json({
      success: true,
      alreadyPrepared: true,
      proposal: {
        id: pendingProposal.id,
        status: pendingProposal.status,
        extraction: pendingProposal.extractedData,
      },
    });
  }

  try {
    const extraction = await extractContract(document.openaiFileId);
    const proposal = await prisma.documentImportProposal.create({ data: { userId, documentId: document.id, extractedData: extraction as unknown as Prisma.InputJsonValue } });
    return NextResponse.json({ success: true, proposal: { id: proposal.id, status: proposal.status, extraction } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível ler o contrato agora.';
    return NextResponse.json({ success: false, message }, { status: 502 });
  }
}
