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
   * Histórico da conversa — CONTROL OS: "separação completa entre NOVA e
   * LEGENDARY" (pedido explícito do usuário). Antes era um único array
   * `novaMessages` compartilhado pelas duas personas ("trocar de persona
   * NUNCA mexe em `novaMessages`" — texto antigo desta mesma nota); o
   * usuário reportou exatamente essa decisão como bug: "ao navegar entre
   * NOVA e LEGENDARY, a conversa anterior permanece... cada IA deve possuir
   * uma sessão independente." Agora é um balde POR PERSONA — entrar em
   * `/legendary` nunca mais mostra o histórico visual de `/nova`, e
   * vice-versa. Mesma razão de viver no store (não em `useState` local de
   * `NovaWorkspace`): sobrevive a fechar/reabrir o painel flutuante e a
   * navegar entre páginas — só que agora com uma chave por persona em vez
   * de uma só.
   */
  novaMessagesByPersona: Record<NovaPersona, ConversationMessage[]>;
  addNovaMessage: (persona: NovaPersona, message: ConversationMessage) => void;
  /**
   * Substitui o histórico inteiro de UMA persona (CONTROL OS — Etapa 4,
   * agora persona-scoped) — usado só pelo resumo automático de conversa
   * (`ConversationService.summarizeOlderTurns`, disparado por
   * `NovaWorkspace` quando o histórico da persona ativa passa de
   * `CONDENSE_THRESHOLD`): as mensagens antigas DAQUELA persona viram um
   * único resumo, as recentes continuam intactas — nunca mexe no balde da
   * outra persona. Diferente de `addNovaMessage` (só anexa).
   */
  replaceNovaMessages: (persona: NovaPersona, messages: ConversationMessage[]) => void;
  /**
   * Atualiza UMA mensagem no lugar, por id (Fase F — "NOVA como centro da
   * experiência"). Diferente de `addNovaMessage` (sempre anexa) e
   * `replaceNovaMessages` (troca o histórico inteiro): usado pela bolha de
   * progresso de análise de documento — o polling curto reescreve o mesmo
   * `id` várias vezes (estágio a estágio) e, ao chegar em COMPLETED, a
   * troca pelo resultado final também é uma chamada desta função, nunca
   * uma mensagem nova. Vive no store (não em estado local do componente)
   * pelo mesmo motivo de sempre: o `set` do Zustand sempre lê o estado mais
   * recente, então o `setInterval` do polling nunca corre risco de
   * trabalhar com um array de mensagens desatualizado (closure obsoleta).
   * Sem correspondência por id: no-op (mensagem já pode ter sido removida
   * por um resumo de conversa nesse meio-tempo).
   */
  updateNovaMessage: (persona: NovaPersona, id: string, patch: Partial<ConversationMessage>) => void;

  /**
   * Persona ativa — qual identidade conduz o próximo turno / qual balde de
   * `novaMessagesByPersona` a tela lê agora. Vive aqui pelo mesmo motivo de
   * sempre: sobrevive a fechar/reabrir o painel e a navegar entre páginas.
   * Efêmero (não persiste reload, ver `partialize` abaixo).
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

      novaMessagesByPersona: { nova: [], legendary: [] },
      addNovaMessage: (persona, message) =>
        set((state) => ({
          novaMessagesByPersona: {
            ...state.novaMessagesByPersona,
            [persona]: [...state.novaMessagesByPersona[persona], message].slice(-MAX_NOVA_MESSAGES),
          },
        })),
      replaceNovaMessages: (persona, messages) =>
        set((state) => ({
          novaMessagesByPersona: { ...state.novaMessagesByPersona, [persona]: messages },
        })),
      updateNovaMessage: (persona, id, patch) =>
        set((state) => ({
          novaMessagesByPersona: {
            ...state.novaMessagesByPersona,
            [persona]: state.novaMessagesByPersona[persona].map((message) => (message.id === id ? { ...message, ...patch } : message)),
          },
        })),

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
