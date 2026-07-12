import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgendaEvent, Debt, FinanceEntry, Mission, TimelineEvent } from '@control-os/types';
import {
  MOCK_AGENDA_EVENTS,
  MOCK_DEBTS,
  MOCK_FINANCE_ENTRIES,
  MOCK_MISSIONS,
  MOCK_TIMELINE,
} from './mock-data';

/**
 * Fonte única de dados de domínio do CONTROL OS (CONTROL OS 3.0).
 *
 * Diferente de `useAppStore` (estado de UI — sidebar, sessão, modais), este
 * store guarda os dados que tanto a navegação manual (Dashboard, Missões,
 * Financeiro) quanto a conversa com a Nova leem e escrevem. Nada pode
 * existir só na conversa ou só na interface — criar uma missão falando com
 * a Nova atualiza o mesmo array que a tela de Missões renderiza, e vice-versa.
 *
 * Seed inicial vem dos dados mockados existentes (`mock-data.ts`); a partir
 * da primeira carga o estado real vive aqui e é persistido localmente.
 */

let idCounter = 0;

/** Gera um id local legível e estável dentro da sessão (sem UUID/lib extra). */
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`;
}

interface DataState {
  missions: Mission[];
  timeline: TimelineEvent[];
  financeEntries: FinanceEntry[];
  agendaEvents: AgendaEvent[];
  debts: Debt[];

  addMission: (mission: Omit<Mission, 'id'>) => Mission;
  updateMission: (id: string, patch: Partial<Omit<Mission, 'id'>>) => void;

  addTimelineEvent: (event: Omit<TimelineEvent, 'id'>) => TimelineEvent;

  addFinanceEntry: (entry: Omit<FinanceEntry, 'id'>) => FinanceEntry;

  addAgendaEvent: (event: Omit<AgendaEvent, 'id'>) => AgendaEvent;

  addDebt: (debt: Omit<Debt, 'id'>) => Debt;
  /** Paga 1 parcela: soma 1 a `installmentsPaid` e reduz `remainingAmount` proporcionalmente. Não faz nada se já quitada. */
  payDebtInstallment: (id: string) => void;
}

export const useDataStore = create<DataState>()(
  persist(
    (set) => ({
      missions: MOCK_MISSIONS,
      timeline: MOCK_TIMELINE,
      financeEntries: MOCK_FINANCE_ENTRIES,
      agendaEvents: MOCK_AGENDA_EVENTS,
      debts: MOCK_DEBTS,

      addMission: (mission) => {
        const created: Mission = { ...mission, id: nextId('ms') };
        set((state) => ({ missions: [created, ...state.missions] }));
        return created;
      },
      updateMission: (id, patch) => {
        set((state) => ({
          missions: state.missions.map((mission) =>
            mission.id === id ? { ...mission, ...patch } : mission
          ),
        }));
      },

      addTimelineEvent: (event) => {
        const created: TimelineEvent = { ...event, id: nextId('tl') };
        set((state) => ({ timeline: [created, ...state.timeline] }));
        return created;
      },

      addFinanceEntry: (entry) => {
        const created: FinanceEntry = { ...entry, id: nextId('fn') };
        set((state) => ({ financeEntries: [created, ...state.financeEntries] }));
        return created;
      },

      addAgendaEvent: (event) => {
        const created: AgendaEvent = { ...event, id: nextId('ag') };
        set((state) => ({ agendaEvents: [created, ...state.agendaEvents] }));
        return created;
      },

      addDebt: (debt) => {
        const created: Debt = { ...debt, id: nextId('db') };
        set((state) => ({ debts: [created, ...state.debts] }));
        return created;
      },
      payDebtInstallment: (id) => {
        set((state) => ({
          debts: state.debts.map((debt) => {
            if (debt.id !== id || debt.installmentsPaid >= debt.installmentsTotal) return debt;
            const perInstallment = debt.totalAmount / debt.installmentsTotal;
            const installmentsPaid = debt.installmentsPaid + 1;
            const remainingAmount = Math.max(0, debt.remainingAmount - perInstallment);
            return { ...debt, installmentsPaid, remainingAmount };
          }),
        }));
      },
    }),
    {
      name: 'control-os-data-state',
    }
  )
);
