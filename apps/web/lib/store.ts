import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@control-os/types';
import { MOCK_USER } from './mock-data';

/**
 * Estado global de UI do CONTROL OS (Zustand).
 *
 * Fase 1: cobre apenas o que a interface precisa para se comportar de forma
 * realista com dados mockados — colapso da Sidebar, sessão mock do usuário e
 * estado do Command Center. Nenhuma chamada de rede acontece aqui ainda;
 * quando a Fase 2 integrar o Control Core™ real, `login`/`logout` passam a
 * chamar apps/api em vez de simular localmente.
 */
interface AppState {
  // Sessão (mock)
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, _password: string) => Promise<void>;
  logout: () => void;

  // Layout Principal
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Sidebar em telas pequenas (drawer off-canvas, Nova Experience — Fase 3).
  // Estado separado de `sidebarCollapsed` (colapso para ícones, desktop) e
  // de propósito puramente efêmero de viewport — por isso não é persistido.
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;

  // Command Center (⌘K)
  commandCenterOpen: boolean;
  setCommandCenterOpen: (open: boolean) => void;

  // Painel flutuante da Nova (CONTROL OS — Etapa 3) — aberto de qualquer
  // módulo pelo `NovaFloatingLauncher`, sem trocar de rota. Efêmero, como
  // `commandCenterOpen`: não faz sentido reabrir sozinho ao recarregar.
  novaPanelOpen: boolean;
  setNovaPanelOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: async (_email, _password) => {
        // Mock: simula latência de rede de um login real.
        await new Promise((resolve) => setTimeout(resolve, 600));
        set({ user: MOCK_USER, isAuthenticated: true });
      },
      logout: () => set({ user: null, isAuthenticated: false }),

      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      mobileNavOpen: false,
      setMobileNavOpen: (open) => set({ mobileNavOpen: open }),

      commandCenterOpen: false,
      setCommandCenterOpen: (open) => set({ commandCenterOpen: open }),

      novaPanelOpen: false,
      setNovaPanelOpen: (open) => set({ novaPanelOpen: open }),
    }),
    {
      name: 'control-os-app-state',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
    }
  )
);
