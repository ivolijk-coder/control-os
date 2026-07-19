import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@control-os/types';
import type { ConversationMessage } from '@/components/nova/nova-message-bubble';
import type { NovaPersona } from '@/services/nova';
import { MOCK_USER } from './mock-data';

/** Limite de mensagens guardadas — evita crescimento sem fim numa sessão longa. */
const MAX_NOVA_MESSAGES = 100;

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

  /**
   * Modo Conversa por voz (CONTROL OS — Etapa 8 — NOVA Voice Experience).
   * Separado de `novaPanelOpen` (o painel de texto) — o botão flutuante
   * global agora abre este overlay de tela cheia (`NovaVoiceOverlay`), não
   * mais o painel de texto; ver `NovaFloatingLauncher`. Efêmero como
   * `novaPanelOpen`: não sobrevive a um reload.
   */
  novaVoiceOpen: boolean;
  setNovaVoiceOpen: (open: boolean) => void;

  /**
   * Histórico da conversa com a NOVA (CONTROL OS — Evolução da experiência
   * NOVA). Antes vivia num `useState` local dentro de `NovaWorkspace`, que
   * reseta a cada montagem — como o painel flutuante desmonta o conteúdo ao
   * fechar (`Dialog.Content` sem `forceMount`), a conversa "esquecia tudo"
   * toda vez que o usuário fechava e reabria o botão flutuante. Mover para
   * cá resolve isso: o estado sobrevive a fechar/reabrir o painel e a
   * navegar entre páginas (é um store singleton), mas ainda é efêmero como
   * `novaPanelOpen` — não teria sentido reabrir o app amanhã e ver a
   * conversa de ontem no meio da tela.
   */
  novaMessages: ConversationMessage[];
  addNovaMessage: (message: ConversationMessage) => void;
  /**
   * Substitui o histórico inteiro (CONTROL OS — Etapa 4) — usado só pelo
   * resumo automático de conversa (`ConversationService.summarizeOlderTurns`,
   * disparado por `NovaWorkspace` quando `novaMessages.length` passa de
   * `CONDENSE_THRESHOLD`): as mensagens antigas viram um único resumo, as
   * recentes continuam intactas. Diferente de `addNovaMessage` (só anexa).
   */
  replaceNovaMessages: (messages: ConversationMessage[]) => void;

  /**
   * Persona ativa da conversa (CONTROL OS — Etapa 15: LEGENDARY). Vive aqui
   * — não em `useState` local de `NovaWorkspace` — pelo mesmo motivo de
   * `novaMessages`: sobrevive a fechar/reabrir o painel flutuante e a
   * navegar entre páginas, sem precisar de nenhum contexto novo. Efêmero
   * como `novaMessages` (não persiste reload, ver `partialize` abaixo) —
   * inconsistente reabrir o app amanhã com "LEGENDARY" selecionada e uma
   * conversa vazia. Trocar de persona NUNCA mexe em `novaMessages` — é
   * literalmente só isto: qual identidade conduz o próximo turno.
   */
  activePersona: NovaPersona;
  setActivePersona: (persona: NovaPersona) => void;
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

      novaVoiceOpen: false,
      setNovaVoiceOpen: (open) => set({ novaVoiceOpen: open }),

      novaMessages: [],
      addNovaMessage: (message) =>
        set((state) => ({ novaMessages: [...state.novaMessages, message].slice(-MAX_NOVA_MESSAGES) })),
      replaceNovaMessages: (messages) => set({ novaMessages: messages }),

      activePersona: 'nova',
      setActivePersona: (persona) => set({ activePersona: persona }),
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
