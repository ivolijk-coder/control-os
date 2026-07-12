import type { Easing, Transition, Variants } from 'framer-motion';

/**
 * Motion System — CONTROL OS (Nova Experience — Fase 1).
 *
 * Presets únicos de animação reutilizados por toda a experiência "viva".
 * Todas as curvas usam os mesmos tokens de `tailwind.config.ts` /
 * `styles/globals.css` (--ease-out, --ease-spring, --dur-*) para garantir
 * consistência entre CSS puro e Framer Motion. Nunca exagerar: distâncias
 * curtas, opacidade suave, sem bounce forte.
 */

export const EASE_OUT: Easing = [0.16, 1, 0.3, 1];
export const EASE_SPRING: Easing = [0.34, 1.56, 0.64, 1];

export const DURATION = {
  fast: 0.15,
  base: 0.26,
  slow: 0.48,
} as const;

export const transitionOut = (duration: number = DURATION.base, delay = 0): Transition => ({
  duration,
  delay,
  ease: EASE_OUT,
});

export const transitionSpring: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 22,
  mass: 0.8,
};

/** Entrada padrão: fade + leve subida. Usado em blocos de página (stagger). */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

/** Entrada com leve escala — usada em cartões e superfícies de destaque. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1 },
};

/** Entrada com blur — reservada para elementos hero (ex.: saudação da Home). */
export const blurIn: Variants = {
  hidden: { opacity: 0, filter: 'blur(6px)', y: 6 },
  visible: { opacity: 1, filter: 'blur(0px)', y: 0 },
};

/** Slide lateral discreto — usado em painéis e itens de lista. */
export const slideIn: Variants = {
  hidden: { opacity: 0, x: -6 },
  visible: { opacity: 1, x: 0 },
};

/** Container com stagger para escalonar filhos (ex.: grid de métricas). */
export const staggerContainer = (staggerChildren = 0.06, delayChildren = 0): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren, delayChildren },
  },
});

/** Hover/tap padrão para superfícies clicáveis (cards, pills, botões grandes). */
export const hoverLift = {
  whileHover: { y: -2, scale: 1.01 },
  whileTap: { scale: 0.98 },
  transition: transitionOut(DURATION.fast),
};

/** Hover/tap mais discreto — usado em itens de navegação e ícones pequenos. */
export const hoverSubtle = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.96 },
  transition: transitionOut(DURATION.fast),
};

/** Pulso de "ripple" suave — usado em confirmações locais (ex.: envio da NOVA). */
export const ripple: Variants = {
  idle: { scale: 1, opacity: 1 },
  pulse: {
    scale: [1, 1.12, 1],
    opacity: [1, 0.7, 1],
    transition: { duration: 0.5, ease: EASE_OUT },
  },
};
