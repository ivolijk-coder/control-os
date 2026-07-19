import type { NovaPersona } from '@/services/nova';
import type { NovaOrbStatus } from '@/components/nova/nova-orb';

/**
 * CONTROL OS — Etapa 17 (Hero Scene R3F): paleta e temporização por
 * persona/status para a nova cena 3D (`nova-hero-scene.tsx` e os
 * componentes em `hero-scene/`). Mesma LINGUAGEM de cor já estabelecida em
 * `nova-orb.tsx` (a versão Canvas 2D, que continua existindo e sendo usada
 * pelo `NovaFloatingLauncher` e outros usos pequenos da Orb — "toda a
 * mudança fica isolada na Hero Scene", nunca um segundo sistema de cor
 * paralelo e divergente) — "azul/ciano, jamais roxo sólido" pra NOVA,
 * "dourado/âmbar, jamais amarelo puro" pra LEGENDARY. Os números em si são
 * re-derivados pro novo pipeline (Three.js trabalha em espaço de cor linear
 * e unidades de mundo/tempo em segundos via `delta`, não pixels/rgba/ms como
 * o Canvas 2D), mas a INTENÇÃO por trás de cada valor é a mesma: mais
 * rápido/amplo quanto mais ativo o `status`.
 */
export const HERO_PERSONA_COLOR: Record<NovaPersona, string> = {
  nova: '#38bdf8',
  legendary: '#d9a455',
};
/** Tom quase-branco — núcleo emissivo (NOVA) / especular concentrado (LEGENDARY). */
export const HERO_PERSONA_COLOR_BRIGHT: Record<NovaPersona, string> = {
  nova: '#e0f2fe',
  legendary: '#f6e4c2',
};
/** Tom escuro da mesma família — usado só na luz ambiente/traseira (nunca cinza puro, mantém a identidade mesmo na sombra). */
export const HERO_PERSONA_COLOR_DIM: Record<NovaPersona, string> = {
  nova: '#0c2a3d',
  legendary: '#2e2210',
};

/** Radianos/segundo — rotação do Hero Object em torno do eixo Y. */
export const HERO_ROTATION_SPEED: Record<NovaOrbStatus, number> = {
  idle: 0.05,
  ouvindo: 0.03,
  pensando: 0.12,
  executando: 0.22,
  respondendo: 0.22,
};
/** Radianos/segundo — velocidade da fase de respiração (usada dentro de `Math.sin`). */
export const HERO_BREATHE_SPEED: Record<NovaOrbStatus, number> = {
  idle: 0.5,
  ouvindo: 0.55,
  pensando: 0.9,
  executando: 1.2,
  respondendo: 1.2,
};
/** Amplitude da respiração — fração do tamanho base. */
export const HERO_BREATHE_AMPLITUDE: Record<NovaOrbStatus, number> = {
  idle: 0.02,
  ouvindo: 0.025,
  pensando: 0.035,
  executando: 0.045,
  respondendo: 0.045,
};
/** Escala de raio sustentada por status — mesmo "ouve → cresce" do `nova-orb.tsx`. */
export const HERO_RADIUS_SCALE: Record<NovaOrbStatus, number> = {
  idle: 1,
  ouvindo: 1.08,
  pensando: 1,
  executando: 1.02,
  respondendo: 1.05,
};

/** Duração do pulso de fala (ms) — mesmo valor de `PULSE_DURATION_MS` em `nova-orb.tsx`, pra sentir idêntico entre as duas superfícies. */
export const HERO_PULSE_DURATION_MS = 220;
export const HERO_PULSE_RADIUS_BOOST = 0.06;

/** Easing por frame da transição NOVA↔LEGENDARY — mesmo raciocínio de `PERSONA_BLEND_EASE` em `nova-orb.tsx` (nunca um corte seco), só recalibrado pro `useFrame` do R3F que já entrega `delta` em segundos em vez de "por frame a ~30fps". */
export const HERO_PERSONA_BLEND_EASE_PER_SECOND = 4.2;
