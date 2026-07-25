import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AgendaEvent,
  Asset,
  Debt,
  FinanceEntry,
  Habit,
  Mission,
  Note,
  PersonalDocument,
  TimelineEvent,
  Trip,
} from '@control-os/types';
import {
  MOCK_AGENDA_EVENTS,
  MOCK_ASSETS,
  MOCK_DEBTS,
  MOCK_DOCUMENTS,
  MOCK_FINANCE_ENTRIES,
  MOCK_HABITS,
  MOCK_MISSIONS,
  MOCK_NOTES,
  MOCK_TIMELINE,
  MOCK_TRIPS,
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
  habits: Habit[];
  documents: PersonalDocument[];
  assets: Asset[];
  trips: Trip[];
  notes: Note[];

  addMission: (mission: Omit<Mission, 'id'>) => Mission;
  updateMission: (id: string, patch: Partial<Omit<Mission, 'id'>>) => void;

  addTimelineEvent: (event: Omit<TimelineEvent, 'id'>) => TimelineEvent;

  addFinanceEntry: (entry: Omit<FinanceEntry, 'id'>) => FinanceEntry;

  addAgendaEvent: (event: Omit<AgendaEvent, 'id'>) => AgendaEvent;
  /** Remove um compromisso pelo próprio calendário, sempre por id exato. */
  deleteAgendaEvent: (id: string) => void;

  addDebt: (debt: Omit<Debt, 'id'>) => Debt;
  /** Paga 1 parcela: soma 1 a `installmentsPaid` e reduz `remainingAmount` proporcionalmente. Não faz nada se já quitada. */
  payDebtInstallment: (id: string) => void;

  addHabit: (habit: Omit<Habit, 'id'>) => Habit;
  /** Alterna `completedToday` e ajusta `streakDays`/`last7Days` (hoje = último índice) de acordo. */
  toggleHabitToday: (id: string) => void;

  addDocument: (document: Omit<PersonalDocument, 'id'>) => PersonalDocument;

  addAsset: (asset: Omit<Asset, 'id'>) => Asset;

  addTrip: (trip: Omit<Trip, 'id'>) => Trip;
  /** Alterna `done` de um item do checklist de uma viagem específica. */
  toggleTripChecklistItem: (tripId: string, itemId: string) => void;

  addNote: (note: Omit<Note, 'id'>) => Note;
  /** Alterna `done` de um item do checklist de uma nota do tipo `checklist`. */
  toggleNoteChecklistItem: (noteId: string, itemId: string) => void;
}

export const useDataStore = create<DataState>()(
  persist(
    (set) => ({
      missions: MOCK_MISSIONS,
      timeline: MOCK_TIMELINE,
      financeEntries: MOCK_FINANCE_ENTRIES,
      agendaEvents: MOCK_AGENDA_EVENTS,
      debts: MOCK_DEBTS,
      habits: MOCK_HABITS,
      documents: MOCK_DOCUMENTS,
      assets: MOCK_ASSETS,
      trips: MOCK_TRIPS,
      notes: MOCK_NOTES,

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
      deleteAgendaEvent: (id) => {
        set((state) => ({ agendaEvents: state.agendaEvents.filter((event) => event.id !== id) }));
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

      addHabit: (habit) => {
        const created: Habit = { ...habit, id: nextId('hb') };
        set((state) => ({ habits: [created, ...state.habits] }));
        return created;
      },
      toggleHabitToday: (id) => {
        set((state) => ({
          habits: state.habits.map((habit) => {
            if (habit.id !== id) return habit;
            const completedToday = !habit.completedToday;
            const streakDays = completedToday
              ? habit.streakDays + 1
              : Math.max(0, habit.streakDays - 1);
            const last7Days = [...habit.last7Days];
            const lastIndex = last7Days.length - 1;
            if (lastIndex >= 0) last7Days[lastIndex] = completedToday;
            return { ...habit, completedToday, streakDays, last7Days };
          }),
        }));
      },

      addDocument: (document) => {
        const created: PersonalDocument = { ...document, id: nextId('doc') };
        set((state) => ({ documents: [created, ...state.documents] }));
        return created;
      },

      addAsset: (asset) => {
        const created: Asset = { ...asset, id: nextId('as') };
        set((state) => ({ assets: [created, ...state.assets] }));
        return created;
      },

      addTrip: (trip) => {
        const created: Trip = { ...trip, id: nextId('tr') };
        set((state) => ({ trips: [created, ...state.trips] }));
        return created;
      },
      toggleTripChecklistItem: (tripId, itemId) => {
        set((state) => ({
          trips: state.trips.map((trip) => {
            if (trip.id !== tripId) return trip;
            return {
              ...trip,
              checklist: trip.checklist.map((item) =>
                item.id === itemId ? { ...item, done: !item.done } : item
              ),
            };
          }),
        }));
      },

      addNote: (note) => {
        const created: Note = { ...note, id: nextId('nt') };
        set((state) => ({ notes: [created, ...state.notes] }));
        return created;
      },
      toggleNoteChecklistItem: (noteId, itemId) => {
        set((state) => ({
          notes: state.notes.map((note) => {
            if (note.id !== noteId || !note.checklistItems) return note;
            return {
              ...note,
              checklistItems: note.checklistItems.map((item) =>
                item.id === itemId ? { ...item, done: !item.done } : item
              ),
            };
          }),
        }));
      },
    }),
    {
      name: 'control-os-data-state',
    }
  )
);
