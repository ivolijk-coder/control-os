'use client';

import {
  documentAnalysisFailed,
  progressStageLabel,
  shouldKeepPollingDocumentAnalysis,
  type DocumentAnalysisProgressStage,
} from '@/lib/document-analysis-progress';

export type DocumentAnalysisPollResult = {
  analysisStatus: string;
  progressStage: DocumentAnalysisProgressStage | null;
  label: string;
  failed: boolean;
};

const POLL_INTERVAL_MS = 3000;

/**
 * Polling curto do progresso de uma análise de documento (Fase F — "NOVA
 * como centro da experiência"). Sem SSE/WebSocket nesta entrega, por
 * pedido explícito — só `fetch` em intervalo curto de
 * `GET /api/documents/:id/analysis-progress`.
 *
 * Função simples (não um hook) de propósito: `nova-workspace.tsx` já é
 * majoritariamente imperativo/callback-based (ver `handleAttachDocument`,
 * `handleTaskAction`) — nenhum outro fluxo assíncrono ali vive num
 * `useEffect` próprio. `onUpdate` é chamado a cada estágio novo (inclusive
 * o primeiro tick, imediatamente); `onSettled` uma única vez, quando o
 * polling para (saiu de QUEUED/PROCESSING) — quem chama decide o que fazer
 * a seguir (substituir a bolha de progresso pelo resultado final).
 *
 * Devolve uma função de cancelamento — chamar se o componente desmontar
 * ou o usuário navegar pra longe antes do polling terminar sozinho.
 */
export function pollDocumentAnalysisProgress(
  documentId: string,
  handlers: { onUpdate: (result: DocumentAnalysisPollResult) => void; onSettled: (result: DocumentAnalysisPollResult) => void }
): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function tick() {
    if (cancelled) return;
    try {
      const response = await fetch(`/api/documents/${documentId}/analysis-progress`);
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; analysisStatus?: string; progressStage?: DocumentAnalysisProgressStage | null }
        | null;
      if (cancelled) return;

      // Erro transitório de rede/servidor: tenta de novo no próximo tick,
      // nunca desiste sozinho — só quem chamou (dono do ciclo de vida da
      // bolha/componente) decide cancelar via a função devolvida.
      if (!response.ok || !payload?.success || !payload.analysisStatus) {
        timer = setTimeout(tick, POLL_INTERVAL_MS);
        return;
      }

      const result: DocumentAnalysisPollResult = {
        analysisStatus: payload.analysisStatus,
        progressStage: payload.progressStage ?? null,
        label: progressStageLabel(payload.progressStage),
        failed: documentAnalysisFailed(payload.analysisStatus),
      };

      if (shouldKeepPollingDocumentAnalysis(payload.analysisStatus)) {
        handlers.onUpdate(result);
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      } else {
        handlers.onSettled(result);
      }
    } catch {
      if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
    }
  }

  void tick();
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
