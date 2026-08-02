import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { getDocumentAnalysisProgress } from '@/services/documents/persistent-document.service';

/**
 * `GET /api/documents/:id/analysis-progress` — polling curto pra UI humana
 * de progresso (Fase F — "NOVA como centro da experiência"). Sem
 * SSE/WebSocket nesta entrega: o cliente (NOVA ou a tela de Documentos)
 * chama isto a cada poucos segundos enquanto `analysisStatus` está
 * `QUEUED`/`PROCESSING`, e para assim que sair desse estado.
 *
 * Rota deliberadamente burra: nenhuma decisão de negócio aqui, só repassa
 * `getDocumentAnalysisProgress`. Quando `analysisStatus` chega em
 * `COMPLETED`/`NEEDS_REVIEW`, o resultado de verdade é a `ConversationTask`
 * já criada na mesma transação do worker (Fase C) — o cliente busca ela em
 * `GET /api/nova/conversation-tasks`, não aqui; esta rota só diz "pode
 * parar de sondar e ir buscar o resultado".
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ success: false, message: 'Faça login para acompanhar a análise.' }, { status: 401 });

  const progress = await getDocumentAnalysisProgress(userId, params.id);
  if (!progress) return NextResponse.json({ success: false, message: 'Documento não encontrado.' }, { status: 404 });

  return NextResponse.json({ success: true, ...progress });
}
