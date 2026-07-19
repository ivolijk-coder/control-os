import * as React from 'react';
import type { NovaContext } from '@/services/nova';
import { useDataStore } from '@/lib/data-store';
import { MOCK_USER } from '@/lib/mock-data';

// Primeiro nome do usuário — mesmo cálculo usado em `HomeHero`/`NovaWorkspace`.
const NOVA_USER_FIRST_NAME = MOCK_USER.name.split(' ')[0] ?? MOCK_USER.name;

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
 */
export function useNovaContext(): NovaContext {
  const addMission = useDataStore((state) => state.addMission);
  const updateMission = useDataStore((state) => state.updateMission);
  const addTimelineEvent = useDataStore((state) => state.addTimelineEvent);
  const addFinanceEntry = useDataStore((state) => state.addFinanceEntry);
  const addAgendaEvent = useDataStore((state) => state.addAgendaEvent);
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

  return React.useMemo(
    () => ({
      actions: {
        addMission,
        updateMission,
        addTimelineEvent,
        addFinanceEntry,
        addAgendaEvent,
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
      timeline,
      userName: NOVA_USER_FIRST_NAME,
    }),
    [
      addMission,
      updateMission,
      addTimelineEvent,
      addFinanceEntry,
      addAgendaEvent,
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
      timeline,
    ]
  );
}
