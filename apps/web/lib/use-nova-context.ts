import * as React from 'react';
import type { NovaContext } from '@/services/nova';
import { useDataStore } from '@/lib/data-store';
import { useAccount } from '@/lib/use-account';
import { firstName } from '@/lib/utils';

// Sem seletor de Space na conversa ainda — toda ação criada pela Nova cai
// num Space padrão (ver mesma constante em `nova-workspace.tsx`).
const DEFAULT_SPACE_ID = 'sp_vida';

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
 * Este hook não busca mais "documento analisado" nenhum — a ponte
 * Documentos -> NOVA que existia aqui (`DocumentInsight`, via
 * `GET /api/documents`) foi retirada nesta evolução ("NOVA como centro da
 * experiência"): documento analisado agora vira uma `ConversationTask`
 * (ver `services/conversation-tasks`), que a NOVA passa a consumir por um
 * caminho próprio (Fase D), fora de `NovaContext`.
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
  // `userName` era a string literal `'Usuário'`. Não era um placeholder
  // esquecido de propósito: era a razão pela qual a saudação da NOVA e a da
  // LEGENDARY cumprimentavam o usuário pelo nome errado em produção. Agora
  // vem da sessão real, pelo mesmo `GET /api/auth/me` que `/configuracoes`
  // já usava. Enquanto a resposta não chega, fica vazio — e quem exibe
  // omite o nome em vez de inventar um.
  const account = useAccount();
  const userName = firstName(account?.name);
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
      // Compatibilidade temporária com o executor legado. Fatos locais não
      // atravessam mais a fronteira da NOVA; fontes sem backend ficam vazias
      // e são declaradas como NOT_IMPLEMENTED pelo ContextProvider real.
      debts: [],
      missions: [],
      agendaEvents: [],
      financeEntries: [],
      habits: [],
      trips: [],
      documents: [],
      assets: [],
      notes: [],
      timeline: [],
      userName,
    }),
    [
      userName,
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
    ]
  );
}
