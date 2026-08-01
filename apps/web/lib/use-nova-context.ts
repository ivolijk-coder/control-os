import * as React from 'react';
import type { DocumentInsight, NovaContext } from '@/services/nova';
import { useDataStore } from '@/lib/data-store';
import { MOCK_USER } from '@/lib/mock-data';

// Primeiro nome do usuário — mesmo cálculo usado em `HomeHero`/`NovaWorkspace`.
const NOVA_USER_FIRST_NAME = MOCK_USER.name.split(' ')[0] ?? MOCK_USER.name;

// Sem seletor de Space na conversa ainda — toda ação criada pela Nova cai
// num Space padrão (ver mesma constante em `nova-workspace.tsx`).
const DEFAULT_SPACE_ID = 'sp_vida';

type DocumentProposalPayload = {
  id: string;
  status: string;
  extractedData: {
    documentType?: string;
    summary?: string | null;
    entities?: { company?: string | null; people?: string[]; dates?: string[]; amounts?: number[] };
    financialOperation?: { detected?: boolean; type?: string | null; creditor?: string | null; amount?: number | null; installments?: number | null };
    suggestedActions?: string[];
  };
};
type DocumentPayload = { id: string; importProposals: DocumentProposalPayload[] };

/**
 * Ponte Documentos -> NOVA (evento interno "documento analisado"):
 * reaproveita `GET /api/documents` — o mesmo endpoint que a tela de
 * Documentos já usa — para achar propostas ainda com `status:
 * 'READY_FOR_REVIEW'` (financeiras aguardando confirmação OU classificação
 * ambígua aguardando decisão manual; nunca `ARCHIVED`, que já não precisa
 * de atenção nenhuma — ver `decideDocumentAction` em
 * `services/documents/contract-analysis.ts`). Falha em silêncio (devolve
 * `[]`): a Nova nunca trava nem inventa um achado quando a API de
 * documentos está indisponível.
 */
function toDocumentInsights(documents: DocumentPayload[]): DocumentInsight[] {
  const insights: DocumentInsight[] = [];
  for (const document of documents) {
    const proposal = document.importProposals.find((candidate) => candidate.status === 'READY_FOR_REVIEW');
    if (!proposal) continue;
    const data = proposal.extractedData;
    insights.push({
      documentId: document.id,
      proposalId: proposal.id,
      documentType: data.documentType ?? 'OTHER',
      summary: data.summary ?? '',
      entities: {
        company: data.entities?.company ?? null,
        people: data.entities?.people ?? [],
        dates: data.entities?.dates ?? [],
        amounts: data.entities?.amounts ?? [],
      },
      financialOperation: {
        detected: data.financialOperation?.detected === true,
        type: data.financialOperation?.type ?? null,
        creditor: data.financialOperation?.creditor ?? null,
        amount: data.financialOperation?.amount ?? null,
        installments: data.financialOperation?.installments ?? null,
      },
      suggestedActions: data.suggestedActions ?? [],
    });
  }
  return insights;
}

/**
 * `useNovaContext` — monta o `NovaContext` real a partir do `useDataStore`
 * (CONTROL OS — Etapa 8). Extraído do `useMemo` que já existia dentro de
 * `NovaWorkspace` para que o novo Modo Conversa por voz (`NovaVoiceOverlay`)
 * fale com a NOVA usando exatamente o mesmo contexto — nenhuma duplicação de
 * lógica entre os dois consumidores, nenhuma chance dos dois divergirem.
 *
 * "Toda a implementação deve reutilizar exatamente a infraestrutura atual"
 * — este hook não cria nenhum dado novo nem nenhuma ação nova, só reaproveita
 * o que `NovaWorkspace` já montava.
 *
 * `documentInsights` é a única exceção que não vem de `useDataStore`: os
 * documentos analisados vivem em Postgres (`DocumentImportProposal`), não
 * no estado do cliente. Busca uma vez por montagem — mesmo espírito de
 * "sem estado próprio dentro de services/nova": este hook só busca e
 * projeta, nunca decide nada.
 */
export function useNovaContext(): NovaContext {
  const addMission = useDataStore((state) => state.addMission);
  const updateMission = useDataStore((state) => state.updateMission);
  const addTimelineEvent = useDataStore((state) => state.addTimelineEvent);
  const addFinanceEntry = useDataStore((state) => state.addFinanceEntry);
  const addAgendaEvent = useDataStore((state) => state.addAgendaEvent);
  const deleteAgendaEvent = useDataStore((state) => state.deleteAgendaEvent);
  const addDebt = useDataStore((state) => state.addDebt);
  const addHabit = useDataStore((state) => state.addHabit);
  const addDocument = useDataStore((state) => state.addDocument);
  const addAsset = useDataStore((state) => state.addAsset);
  const addTrip = useDataStore((state) => state.addTrip);
  const addNote = useDataStore((state) => state.addNote);
  const debts = useDataStore((state) => state.debts);
  const missions = useDataStore((state) => state.missions);
  const agendaEvents = useDataStore((state) => state.agendaEvents);
  const financeEntries = useDataStore((state) => state.financeEntries);
  const habits = useDataStore((state) => state.habits);
  const trips = useDataStore((state) => state.trips);
  const documents = useDataStore((state) => state.documents);
  const assets = useDataStore((state) => state.assets);
  const notes = useDataStore((state) => state.notes);
  // Etapa 13 (NOVA Proativa) — ver comentário de `timeline` em `NovaContext`.
  const timeline = useDataStore((state) => state.timeline);

  const [documentInsights, setDocumentInsights] = React.useState<DocumentInsight[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/documents');
        if (!response.ok) return;
        const payload = await response.json() as { success?: boolean; documents?: DocumentPayload[] };
        if (!cancelled) setDocumentInsights(toDocumentInsights(payload.documents ?? []));
      } catch {
        // Sem achado nenhum é o estado seguro — nunca inventa um documento
        // analisado quando a busca falha.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return React.useMemo(
    () => ({
      actions: {
        addMission,
        updateMission,
        addTimelineEvent,
        addFinanceEntry,
        addAgendaEvent,
        deleteAgendaEvent,
        addDebt,
        addHabit,
        addDocument,
        addAsset,
        addTrip,
        addNote,
      },
      defaultSpaceId: DEFAULT_SPACE_ID,
      debts,
      missions,
      agendaEvents,
      financeEntries,
      habits,
      trips,
      documents,
      assets,
      notes,
      documentInsights,
      timeline,
      userName: NOVA_USER_FIRST_NAME,
    }),
    [
      addMission,
      updateMission,
      addTimelineEvent,
      addFinanceEntry,
      addAgendaEvent,
      deleteAgendaEvent,
      addDebt,
      addHabit,
      addDocument,
      addAsset,
      addTrip,
      addNote,
      debts,
      missions,
      agendaEvents,
      financeEntries,
      habits,
      trips,
      documents,
      assets,
      notes,
      documentInsights,
      timeline,
    ]
  );
}
