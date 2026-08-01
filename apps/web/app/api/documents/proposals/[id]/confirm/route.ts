import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { ConfirmationError, confirmDocumentProposal } from '@/services/documents/document-proposal-confirmation.service';

/**
 * Rota fina: autentica, valida o corpo da requisição e delega toda a regra
 * de negócio para `DocumentProposalConfirmationService`. Nenhuma lógica de
 * confirmação vive mais aqui — a NOVA (Fase E) chama o mesmo service
 * diretamente, sem passar por HTTP, garantindo uma única fonte de verdade.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const userId = await currentSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const body = await request.json().catch(() => null) as { accountId?: string; categoryId?: string; startDate?: string } | null;
  if (!body?.accountId || !body.categoryId) {
    return NextResponse.json({ error: 'Escolha a conta bancária e a categoria antes de confirmar.' }, { status: 400 });
  }

  try {
    const outcome = await confirmDocumentProposal({
      proposalId: params.id,
      userId,
      accountId: body.accountId,
      categoryId: body.categoryId,
      startDate: body.startDate,
    });
    return NextResponse.json({ ok: true, ...outcome });
  } catch (error) {
    if (error instanceof ConfirmationError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
