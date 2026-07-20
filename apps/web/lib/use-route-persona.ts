'use client';

import { usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import type { NovaPersona } from '@/services/nova';

export interface RoutePersona {
  /**
   * Persona "dona" da rota atual — `'nova'`/`'legendary'` só dentro de
   * `/nova`/`/legendary`, `undefined` em qualquer outra página (Dashboard,
   * Financeiro, Agenda...). Lida diretamente da URL (`usePathname`), nunca
   * inferida de `activePersona` — CONTROL OS: "o modal/a interface deve
   * detectar automaticamente a rota atual", não confiar só em estado que
   * outro componente ainda pode não ter sincronizado.
   */
  routePersona: NovaPersona | undefined;
  /** `routePersona`, com fallback pra `activePersona` do store fora de /nova e /legendary — mesmo padrão já usado em `NovaWorkspace` (`effectivePersona`). */
  effectivePersona: NovaPersona;
}

/**
 * useRoutePersona — fonte única pra "qual IA é dona da tela agora",
 * compartilhada por tudo que precisa reagir à troca NOVA ↔ LEGENDARY de
 * forma síncrona com a navegação: `NovaFloatingPanel` (trava a persona do
 * modal pela rota), `LayoutPrincipal` (glow ambiente, fundo de partículas)
 * e `PersonaTransitionStage` (transição cinematográfica entre as rotas).
 * Extraído da lógica que já existia duplicada em `NovaFloatingPanel` — um
 * único lugar pra essa regra, nunca duas implementações que podem divergir.
 */
export function useRoutePersona(): RoutePersona {
  const pathname = usePathname();
  const activePersona = useAppStore((state) => state.activePersona);

  const routePersona: NovaPersona | undefined = pathname?.startsWith('/legendary')
    ? 'legendary'
    : pathname?.startsWith('/nova')
      ? 'nova'
      : undefined;

  return { routePersona, effectivePersona: routePersona ?? activePersona };
}
