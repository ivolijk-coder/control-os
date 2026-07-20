'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { useMediaQuery } from '@control-os/hooks';
import { useRoutePersona } from '@/lib/use-route-persona';
import { HERO_PERSONA_COLOR } from '@/components/nova/hero-scene/hero-scene-constants';
import { hexToRgba } from '@/lib/utils';
import { EASE_OUT } from '@/lib/motion';
import type { NovaPersona } from '@/services/nova';

// CONTROL OS — "otimização completa da experiência mobile" (Performance):
// mesmo breakpoint usado em `background-network.tsx`/`mobile-bottom-nav.tsx`.
const MOBILE_BREAKPOINT_QUERY = '(max-width: 767px)';

/**
 * PersonaTransitionStage + PersonaEnergyFlash + PersonaAmbientGlow —
 * transição cinematográfica entre NOVA e LEGENDARY (pedido explícito do
 * usuário: "não quero apenas trocar de página... quero que pareça uma
 * transformação entre duas inteligências", referência: Arc Browser, Apple
 * Vision Pro, Linear, Framer).
 *
 * Por que isto vive em `components/layout/`, não dentro de `NovaWorkspace`:
 * `/nova` e `/legendary` são PÁGINAS distintas (`app/(dashboard)/nova/
 * page.tsx` e `.../legendary/page.tsx`) — o Next.js desmonta a árvore
 * inteira de uma e monta a da outra ao navegar, então nenhum componente
 * DENTRO dessa árvore sobrevive à troca pra poder animar a transição entre
 * as duas. Só `(dashboard)/layout.tsx` (via `LayoutPrincipal`) permanece
 * montado nos dois lados — é o único lugar onde dá pra "ver" a troca
 * acontecendo e orquestrar uma saída + entrada coordenadas, em vez de um
 * corte instantâneo.
 */

const CONTENT_VARIANTS: Variants = {
  initial: { opacity: 0, scale: 0.985, y: 18, filter: 'blur(14px)' },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.38, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    scale: 0.985,
    y: -14,
    filter: 'blur(14px)',
    transition: { duration: 0.24, ease: EASE_OUT },
  },
};

/** Variante quase instantânea pra quem prefere menos movimento — ainda troca de tela, sem blur/escala/deslocamento. */
const REDUCED_CONTENT_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.12, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.08, ease: EASE_OUT } },
};

// CONTROL OS — "otimização completa da experiência mobile" (Performance):
// `filter: blur(...)` é a parte mais cara de compositar em `CONTENT_VARIANTS`
// — GPUs de celular (principalmente Android médio/entrada) lidam pior com
// filtros CSS animados do que desktop. Mantém fade + leve deslocamento (o
// "premium" da transição continua perceptível) e derruba só o blur, que era
// a fatia mais pesada do custo de renderização nesse momento específico
// (troca de rota, já concorrendo com o resto da página montando).
const MOBILE_CONTENT_VARIANTS: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.18, ease: EASE_OUT } },
};

/**
 * PersonaTransitionStage — envolve `{children}` (a página atual) com a
 * troca coreografada de saída/entrada. Só entra em cena dentro de /nova e
 * /legendary (`routePersona` truthy) — fora dessas duas rotas, `children`
 * renderiza direto, sem nenhum wrapper extra: zero risco de regressão em
 * qualquer outra tela do produto (Financeiro, Agenda, Dashboard...), que
 * continuam trocando exatamente como sempre trocaram.
 *
 * `mode="wait"`: a tela que está saindo termina de sumir (~240ms) ANTES da
 * nova começar a entrar (~380ms) — soma ~620ms, dentro da janela de
 * 500–700ms pedida. Também evita ter as duas árvores montadas ao mesmo
 * tempo (relevante pro Hero Scene em React Three Fiber da LEGENDARY —
 * nunca dois Canvas WebGL tentando existir simultaneamente). `key=
 * {routePersona}` é o que faz o Framer Motion tratar NOVA→LEGENDARY como
 * uma troca de identidade (exit+enter reais), não uma atualização de props
 * do mesmo componente.
 *
 * CONTROL OS — "otimização completa da experiência mobile" (Performance,
 * "evitar excesso de animações simultâneas"): abaixo de `md`, usa
 * `MOBILE_CONTENT_VARIANTS` (sem `filter: blur`, a parte mais cara pra
 * compositar) e não monta `PersonaEnergyFlash` — o clarão radial full-
 * screen é puramente decorativo (reforça a sensação de "mudança de
 * energia" já comunicada pelo `PersonaAmbientGlow` de fundo) e é uma
 * terceira camada animada rodando ao mesmo tempo da troca de conteúdo;
 * cortá-la no mobile é puro ganho de fluidez sem tirar nenhuma capacidade
 * (a troca de rota continua clara: fade + leve deslocamento + o glow de
 * fundo mudando de cor).
 */
export function PersonaTransitionStage({ children }: { children: React.ReactNode }) {
  const { routePersona } = useRoutePersona();
  const shouldReduceMotion = useReducedMotion();
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT_QUERY);

  if (!routePersona) return <>{children}</>;

  const variants = shouldReduceMotion ? REDUCED_CONTENT_VARIANTS : isMobile ? MOBILE_CONTENT_VARIANTS : CONTENT_VARIANTS;

  return (
    <>
      {!shouldReduceMotion && !isMobile && <PersonaEnergyFlash persona={routePersona} />}
      <AnimatePresence mode="wait">
        <motion.div key={routePersona} variants={variants} initial="initial" animate="animate" exit="exit">
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

/**
 * Rajada de luz central, sincronizada com a troca de persona — "o objeto
 * central da IA ganha destaque" + "a energia muda de cor: azul → dourado /
 * dourado → azul". Um clarão radial, na cor da IA de DESTINO, que nasce e
 * se apaga sozinho (~650ms) exatamente no momento da troca.
 *
 * Não tenta fundir de verdade os dois objetos hero — um é DOM/CSS
 * (`NovaRingObject`) e o outro é uma cena WebGL separada (`NovaHeroScene`,
 * React Three Fiber), ver `nova-hero-stage.tsx`: as duas tecnologias não
 * têm como fazer cross-dissolve real entre si, ainda mais atravessando um
 * desmonte de página inteira. Este clarão cobre exatamente essa lacuna —
 * a sensação de "energia mudando de cor" no centro da tela — sem depender
 * de nenhum dos dois objetos hero sobreviver à navegação.
 *
 * `position: fixed` (não `absolute`): centralizado no viewport, imune a
 * `<main>` estar rolado ou o conteúdo ser mais alto que a tela.
 * `pointer-events-none` sempre — nunca bloqueia clique em nada por baixo.
 */
function PersonaEnergyFlash({ persona }: { persona: NovaPersona }) {
  const color = HERO_PERSONA_COLOR[persona];

  return (
    <motion.div
      key={persona}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: [0, 0.85, 0], scale: [0.6, 1.2, 1.45] }}
      transition={{ duration: 0.65, ease: EASE_OUT, times: [0, 0.4, 1] }}
    >
      <div
        className="h-[55vmin] w-[55vmin] rounded-full"
        style={{
          background: `radial-gradient(circle, ${hexToRgba(color, 0.4)} 0%, ${hexToRgba(color, 0.14)} 45%, transparent 72%)`,
          filter: 'blur(32px)',
        }}
      />
    </motion.div>
  );
}

/**
 * PersonaAmbientGlow — antes `LayoutPrincipal` trocava `bg-ambient-glow` ⇄
 * `bg-ambient-glow-gold` como uma className condicional simples (corte
 * instantâneo, item 4 do pedido do usuário: "o fundo recebe uma
 * iluminação sutil acompanhando a nova IA" — só é verdade se a mudança for
 * gradual). Duas camadas sempre montadas, cross-fade de opacidade via
 * Framer Motion — mesmo par de gradientes de sempre (`tailwind.config.ts`),
 * só que agora sincronizados com a mesma janela de tempo da transição de
 * conteúdo.
 *
 * `-z-20`: mais atrás que `BackgroundNetwork` (`-z-10`, partículas) e que
 * qualquer conteúdo em fluxo normal (Sidebar/Topbar/main, sem posição
 * definida) — mesma técnica já usada em `background-network.tsx`.
 */
export function PersonaAmbientGlow({ persona }: { persona: NovaPersona }) {
  const shouldReduceMotion = useReducedMotion();
  const isLegendary = persona === 'legendary';
  const transition = shouldReduceMotion ? { duration: 0 } : { duration: 0.6, ease: EASE_OUT };

  return (
    <div className="pointer-events-none fixed inset-0 -z-20" aria-hidden>
      <motion.div
        className="absolute inset-0 bg-ambient-glow bg-fixed motion-safe:animate-ambient-drift"
        animate={{ opacity: isLegendary ? 0 : 1 }}
        transition={transition}
      />
      <motion.div
        className="absolute inset-0 bg-ambient-glow-gold bg-fixed motion-safe:animate-ambient-drift"
        animate={{ opacity: isLegendary ? 1 : 0 }}
        transition={transition}
      />
    </div>
  );
}
