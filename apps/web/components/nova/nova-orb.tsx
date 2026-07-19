'use client';

import * as React from 'react';
import { useMediaQuery } from '@control-os/hooks';
import type { NovaPersona } from '@/services/nova';

// CONTROL OS — Etapa 8: `'ouvindo'`/`'respondendo'` adicionados de forma
// aditiva (Modo Conversa por voz) — os três estados originais continuam
// valendo pra conversa por texto, sem quebrar nenhum consumidor existente.
export type NovaOrbStatus = 'idle' | 'pensando' | 'executando' | 'ouvindo' | 'respondendo';

interface OrbPoint {
  theta: number; // longitude
  phi: number; // latitude (0..PI)
  seed: number; // fase individual — cada ponto "respira" fora de sincronia com os outros
  /** Multiplicador individual sobre a velocidade angular da camada — "velocidade diferente" por partícula, não só por camada (CONTROL OS — Etapa 11C). */
  spinFactor: number;
  /** Multiplicador individual sobre o tamanho base — "tamanho diferente" por partícula (Etapa 11C), além da variação por profundidade já existente. */
  sizeFactor: number;
}

interface OrbShell {
  /** Fração do raio principal que esta camada ocupa — dá profundidade em 3 níveis (externa/média/núcleo). */
  radiusFraction: number;
  /** Multiplicador sobre a velocidade de rotação principal — cada camada gira num ritmo diferente. */
  rotationMultiplier: number;
  /** Fração do total de pontos que esta camada recebe (soma ≈ 1). */
  pointShare: number;
  opacityScale: number;
  sizeScale: number;
  /** Amplitude de "respiração" individual de cada ponto — camadas mais internas oscilam menos. */
  jitterScale: number;
  /** Fase própria de respiração — cada camada "respira" no seu próprio ritmo, não em sincronia. */
  breathePhaseOffset: number;
}

interface OrbWave {
  bornAt: number;
}

interface OrbBurst {
  bornAt: number;
  angle: number;
}

const POINT_COUNT = 420;
const TARGET_FRAME_MS = 33; // ~30fps — mesmo orçamento de frame do BackgroundNetwork.

// CONTROL OS — Etapa 12 (NOVA Living Entity): em vez de uma nuvem de pontos
// única e rígida, 3 camadas concêntricas — "camada externa, camada média,
// núcleo" — cada uma com rotação e respiração próprias. É isso que dá
// sensação real de volume/3D sem WebGL: as camadas nunca se movem em
// sincronia perfeita, então a esfera nunca "trava" numa pose.
const SHELLS: OrbShell[] = [
  { radiusFraction: 1.0, rotationMultiplier: 1.0, pointShare: 0.5, opacityScale: 0.85, sizeScale: 1.0, jitterScale: 1.15, breathePhaseOffset: 0 },
  { radiusFraction: 0.74, rotationMultiplier: -0.62, pointShare: 0.32, opacityScale: 0.7, sizeScale: 0.85, jitterScale: 0.9, breathePhaseOffset: 1.9 },
  { radiusFraction: 0.44, rotationMultiplier: 1.6, pointShare: 0.18, opacityScale: 1.0, sizeScale: 0.7, jitterScale: 0.55, breathePhaseOffset: 3.7 },
];

const ROTATION_SPEED: Record<NovaOrbStatus, number> = {
  idle: 0.0018,
  pensando: 0.004,
  executando: 0.009,
  // CONTROL OS — Etapa 11B: "ouvindo... movimento desacelera" — mais devagar
  // que o próprio idle, não mais rápido: a NOVA fica quieta pra prestar
  // atenção, o glow/inclinação é que comunicam presença ativa, não a
  // rotação.
  ouvindo: 0.001,
  respondendo: 0.009,
};

// CONTROL OS — Etapa 10A: "a orb deve transmitir sensação de inteligência
// viva. Nunca parecer um loader." A rotação já existia; o que faltava era
// RESPIRAÇÃO orgânica (não-linear, via seno) — mais rápida e um pouco mais
// ampla nos estados ativos, quase parada no ócio, nunca mecânica.
const BREATHE_SPEED_BY_STATUS: Record<NovaOrbStatus, number> = {
  idle: 0.018,
  ouvindo: 0.02,
  pensando: 0.032,
  executando: 0.045,
  respondendo: 0.045,
};
const BREATHE_AMPLITUDE_BY_STATUS: Record<NovaOrbStatus, number> = {
  idle: 0.02,
  ouvindo: 0.025,
  pensando: 0.035,
  executando: 0.045,
  respondendo: 0.045,
};

// CONTROL OS — Etapa 11: "ouve → cresce" — além da respiração (oscila pra
// dentro e pra fora), 'ouvindo' ganha um raio-base maior, sustentado
// enquanto o status durar — presença que avança em direção ao usuário, não
// só um pulso passageiro.
const RADIUS_SCALE_BY_STATUS: Record<NovaOrbStatus, number> = {
  idle: 1,
  ouvindo: 1.08,
  pensando: 1,
  executando: 1.02,
  respondendo: 1.05,
};

// "Fala → pulsa conforme as palavras": cada fronteira de palavra reportada
// pelo VoiceProvider (`pulseSignal` incrementando) dá um empurrão curto e
// decrescente no raio — nunca uma reação fixa/mecânica por frame.
const PULSE_DURATION_MS = 220;
const PULSE_BOOST = 0.05;
// CONTROL OS — Etapa 11B: "o glow deve acompanhar a voz" — o mesmo pulso
// que empurra o raio também acende o glow por um instante, decaindo junto.
const PULSE_GLOW_BOOST = 0.12;

// Velocidade de rotação muda suavemente (lerp) em vez de saltar na hora que
// `status` muda — "transições suaves" — sem isso, ir de 'idle' pra
// 'executando' fazia a esfera acelerar num corte seco de um frame pro outro.
const ROTATION_EASE = 0.06;

// Ondas de energia que nascem no centro e se dissolvem pra fora — "ondas...
// energia" pedidos explicitamente. Mais raras e quase imperceptíveis em
// repouso; um pouco mais presentes (nunca chamativas) enquanto a NOVA
// pensa/executa/responde/ouve. CONTROL OS — Etapa 12: quando a NOVA fala,
// cada palavra (`pulseSignal`) também nasce uma onda própria — "cada frase
// gera pequenas ondas" — além destas por temporizador.
const WAVE_LIFETIME_MS = 1800;
const WAVE_MAX_EXPANSION = 0.6; // fração do raio que a onda cresce até desaparecer
const WAVE_INTERVAL_MS: Record<NovaOrbStatus, number> = {
  idle: 6000,
  ouvindo: 4600,
  pensando: 2200,
  executando: 2200,
  respondendo: 2600,
};

/**
 * CONTROL OS — Etapa 15 (LEGENDARY): identidade visual por persona — cor
 * (glow/partículas) e comportamento (rotação/respiração/jitter/batimento/
 * ondas) mudam suavemente entre NOVA (roxo/azul, "tecnológica, enérgica") e
 * LEGENDARY (dourado/âmbar, "elegante, calma, sábia"), nunca com um corte
 * seco de um frame pro outro — ver `personaBlend`/`PERSONA_BLEND_EASE`
 * abaixo, mesma técnica de easing-em-direção-ao-alvo já usada por
 * `ROTATION_EASE`/`TILT_EASE`.
 *
 * Cores em tuplas `[r, g, b]` (não strings pré-formatadas) porque cada
 * frame precisa INTERPOLAR entre a cor da NOVA e a da LEGENDARY conforme
 * `personaBlend` avança — uma tupla numérica permite fazer essa média sem
 * parsear string nenhuma (`lerpRgb` abaixo). Substitui o antigo
 * `GLOW_COLOR_BY_STATUS` (que só cobria a NOVA) — os valores de
 * `PERSONA_BASE_GLOW_RGB.nova`/`PERSONA_LISTENING_GLOW_RGB.nova` são
 * exatamente os mesmos de antes, então a NOVA continua pixel-idêntica a
 * antes desta etapa.
 */
const PERSONA_BASE_GLOW_RGB: Record<NovaPersona, readonly [number, number, number]> = {
  // Roxo é a cor de base da NOVA em todo o resto do produto (accent-purple).
  nova: [139, 92, 246],
  // Dourado/âmbar (accent-gold, `tailwind.config.ts`) — identidade própria
  // da LEGENDARY, nunca uma variação da paleta da NOVA.
  legendary: [217, 164, 85],
};
/** Só `'ouvindo'` usa esta variação — reforça "está escutando" sem introduzir uma terceira cor à identidade de cada persona. */
const PERSONA_LISTENING_GLOW_RGB: Record<NovaPersona, readonly [number, number, number]> = {
  // Tom azulado, ecoando os nós de destaque do `BackgroundNetwork`.
  nova: [99, 141, 246],
  // Dourado mais claro e quente — "presença atenta" na mesma família de cor
  // da LEGENDARY, nunca azul (que pertence só à identidade da NOVA).
  legendary: [235, 199, 138],
};
/** Cor das partículas em si (pontos da esfera + partículas de execução) — mesma lógica de blend do glow, só mais clara/saturada. */
const PERSONA_POINT_COLOR_RGB: Record<NovaPersona, readonly [number, number, number]> = {
  nova: [196, 181, 253],
  legendary: [240, 214, 168],
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function lerpRgb(a: readonly [number, number, number], b: readonly [number, number, number], t: number): string {
  return `${Math.round(lerp(a[0], b[0], t))}, ${Math.round(lerp(a[1], b[1], t))}, ${Math.round(lerp(a[2], b[2], t))}`;
}

/**
 * CONTROL OS — Etapa 16B (LEGENDARY): geometria do cristal facetado — a
 * escolha explícita do usuário foi "construir a geometria de cristal
 * facetado" (não só recolorir a esfera): a LEGENDARY passa a ser um sólido
 * de faces triangulares planas (bipirâmide de 8 lados — "coroa" curta em
 * cima, "pavilhão" mais longo embaixo, como um corte de gema), sombreado
 * por direção de luz fixa (metal escovado/dourado) em vez da nuvem de
 * partículas orgânica da NOVA. Geometria estática (nunca recalculada por
 * frame) — só a ROTAÇÃO/inclinação aplicadas em `drawFrame` mudam a cada
 * frame, reaproveitando exatamente `shellAngles[0]`/`tiltAngle`, os mesmos
 * estados que já giram/inclinam a esfera (nunca uma segunda física
 * paralela). Continua no MESMO canvas/`drawFrame` que a esfera — nunca um
 * segundo componente/canvas — a transição entre as duas geometrias é um
 * crossfade de opacidade puro governado por `personaBlend` (ver uso de
 * `ctx.globalAlpha` mais abaixo), a mesma variável que já governa cor e
 * comportamento do resto do efeito.
 */
function sub3(a: readonly [number, number, number], b: readonly [number, number, number]): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross3(a: readonly [number, number, number], b: readonly [number, number, number]): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function normalize3(v: readonly [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}
function dot3(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

interface CrystalFace {
  readonly indices: readonly [number, number, number];
}
interface CrystalGeometry {
  readonly vertices: readonly (readonly [number, number, number])[];
  readonly faces: readonly CrystalFace[];
}

/** 8 lados — coroa curta (ápice + anel) em cima, pavilhão mais longo (anel + ápice) embaixo, como um corte de gema. Índices fixos: 0 = ápice de cima, 1 = ápice de baixo, 2..9 = anel. */
const CRYSTAL_SIDES = 8;
function buildCrystalGeometry(): CrystalGeometry {
  const vertices: Array<readonly [number, number, number]> = [
    [0, -1.3, 0], // 0 — ápice de cima (coroa)
    [0, 1.05, 0], // 1 — ápice de baixo (pavilhão, mais longo que a coroa)
  ];
  const girdleStart = 2;
  for (let i = 0; i < CRYSTAL_SIDES; i += 1) {
    const theta = (i / CRYSTAL_SIDES) * Math.PI * 2;
    vertices.push([Math.cos(theta) * 0.95, -0.1, Math.sin(theta) * 0.95]);
  }
  const faces: CrystalFace[] = [];
  for (let i = 0; i < CRYSTAL_SIDES; i += 1) {
    const next = (i + 1) % CRYSTAL_SIDES;
    faces.push({ indices: [0, girdleStart + i, girdleStart + next] });
    faces.push({ indices: [1, girdleStart + next, girdleStart + i] });
  }
  return { vertices, faces };
}
const CRYSTAL_GEOMETRY: CrystalGeometry = buildCrystalGeometry();
// Luz fixa vindo de cima-esquerda-frente — "iluminação de vitrine" sobre
// metal escovado, nunca uma luz que acompanha a câmera (o que faria o
// cristal parecer sempre uniformemente iluminado, sem volume).
const CRYSTAL_LIGHT_DIR: readonly [number, number, number] = normalize3([-0.5, -0.8, 0.6]);
const CRYSTAL_SHADE_DARK_RGB: readonly [number, number, number] = [52, 38, 18];
const CRYSTAL_SHADE_BRIGHT_RGB: readonly [number, number, number] = [255, 226, 168];

/**
 * Multiplicadores da LEGENDARY sobre cada parâmetro de comportamento já
 * existente (rotação, respiração, jitter, batimento, ondas, partículas de
 * execução) — nunca uma tabela paralela por status: em `personaBlend = 0`
 * (NOVA pura) todo multiplicador aplicado é 1 (nenhuma mudança); em
 * `personaBlend = 1` (LEGENDARY pura) cada parâmetro passa a valer
 * `base * este multiplicador`. "Mais fluida, orgânica, contemplativa" vira,
 * em números: gira mais devagar, respira mais devagar e mais amplo, jitter
 * (tremor individual das partículas) mais suave, batimento mais discreto,
 * ondas mais espaçadas — o oposto de "mais enérgica, tecnológica" (NOVA).
 */
const PERSONA_LEGENDARY_MULTIPLIER = {
  rotation: 0.5,
  breatheSpeed: 0.65,
  breatheAmplitude: 1.3,
  jitter: 0.55,
  heartbeat: 0.7,
  waveInterval: 1.7,
  silhouette: 1.35,
  burstInterval: 1.8,
} as const;

/** `1` em `blend = 0` (NOVA), `PERSONA_LEGENDARY_MULTIPLIER[key]` em `blend = 1` (LEGENDARY) — interpolado suavemente entre os dois durante a transição. */
function personaMultiplier(key: keyof typeof PERSONA_LEGENDARY_MULTIPLIER, blend: number): number {
  return 1 + (PERSONA_LEGENDARY_MULTIPLIER[key] - 1) * blend;
}

// "500–700ms, nada brusco" (Etapa 15) — mesma técnica de easing-em-direção-
// ao-alvo de `ROTATION_EASE`/`TILT_EASE`, nunca um corte seco de um frame
// pro outro. `(1 - 0.15)^18 ≈ 0.05` — a transição fica ~95% completa em 18
// frames, que a ~30fps (`TARGET_FRAME_MS`) é ~600ms.
const PERSONA_BLEND_EASE = 0.15;

// CONTROL OS — Etapa 11B: "o núcleo deve ser muito suave, quase
// imperceptível, e pulsar lentamente" — duas batidas curtas por ciclo (como
// um batimento real: tum-TUM, silêncio...), mas com intensidade baixa o
// bastante pra nunca parecer um LED piscando.
const HEARTBEAT_PERIOD_MS_BY_STATUS: Record<NovaOrbStatus, number> = {
  idle: 3800,
  ouvindo: 2900,
  pensando: 1800,
  executando: 1300,
  respondendo: 1300,
};
const HEARTBEAT_INTENSITY_BY_STATUS: Record<NovaOrbStatus, number> = {
  idle: 0.05,
  ouvindo: 0.08,
  pensando: 0.11,
  executando: 0.14,
  respondendo: 0.15,
};

function heartbeatPulse(phase: number): number {
  const bump = (center: number, width: number) => {
    const distance = phase - center;
    return Math.exp(-(distance * distance) / (2 * width * width));
  };
  return Math.min(1, bump(0.05, 0.045) + 0.55 * bump(0.24, 0.05));
}

// CONTROL OS — Etapa 12: "quando escuta, a esfera poderia inclinar — como
// Vision Pro." Rotação em torno do eixo X aplicada a todos os pontos antes
// de projetar na tela — só 'ouvindo' tem alvo diferente de zero.
const TILT_TARGET_BY_STATUS: Record<NovaOrbStatus, number> = {
  idle: 0,
  ouvindo: 0.22,
  pensando: 0,
  executando: 0,
  respondendo: 0,
};
const TILT_EASE = 0.05;

// CONTROL OS — Etapa 12: "algumas sobem, outras descem, velocidade
// aleatória" — cada ponto oscila individualmente (raio, latitude, brilho e
// opacidade) em vez de girar rigidamente preso à esfera. `pseudoNoise` não é
// Simplex/Perlin de verdade (evita adicionar dependência nova ao projeto —
// o sandbox nem tem acesso ao registry do npm pra instalar uma), mas soma
// senos com frequências e fases diferentes por ponto — suave, contínuo,
// nunca se repete de forma óbvia num loop curto. "Nunca todos iguais. Nunca
// sincronizados" (Etapa 11B) — cada chamada usa uma combinação diferente de
// `seed` como semente de fase, então dois pontos nunca oscilam em uníssono.
function pseudoNoise(seed: number, t: number): number {
  return (
    Math.sin(t * 0.9 + seed * 12.9898) * 0.5 +
    Math.sin(t * 1.7 + seed * 4.114) * 0.3 +
    Math.sin(t * 2.6 + seed * 7.233) * 0.2
  );
}
const JITTER_RADIUS_AMPLITUDE_BY_STATUS: Record<NovaOrbStatus, number> = {
  idle: 0.02,
  // CONTROL OS — Etapa 11B: "partículas prestam atenção" enquanto ouve —
  // oscilam menos, não mais, do que em repouso: presença focada, não agitada.
  ouvindo: 0.012,
  pensando: 0.05,
  executando: 0.06,
  respondendo: 0.08,
};
const JITTER_PHI_AMPLITUDE_BY_STATUS: Record<NovaOrbStatus, number> = {
  idle: 0.04,
  ouvindo: 0.02,
  pensando: 0.07,
  executando: 0.08,
  respondendo: 0.1,
};

// CONTROL OS — Etapa 12: "quando executa, a esfera poderia emitir
// partículas para os lados — como se estivesse enviando comandos."
// Partículas curtas, nascendo na superfície e voando pra fora até sumir —
// só enquanto `status === 'executando'`.
const BURST_INTERVAL_MS = 180;
const BURST_LIFETIME_MS = 650;

const POINT_BRIGHTNESS_BY_STATUS: Record<NovaOrbStatus, number> = {
  idle: 1,
  ouvindo: 1.05,
  pensando: 1.05,
  executando: 1.15,
  respondendo: 1.2,
};

// Achatamento vertical usado em toda projeção pseudo-3D (pontos, ondas,
// partículas, reflexo, silhueta) — mesma elipse, nunca um círculo perfeito
// visto de lado, reforçando a sensação de esfera e não de disco.
const DEPTH_SQUASH = 1;

// CONTROL OS — Etapa 11B: "a silhueta ainda está perfeita demais... pequenas
// deformações orgânicas, muito discretas — como um organismo respirando."
// Em vez de um círculo/elipse geométrico perfeito pra casca de vidro, o raio
// em cada ângulo é levemente modulado por ruído — a borda nunca fica
// exatamente igual de um frame pro outro.
const SILHOUETTE_SEGMENTS = 48;
const SILHOUETTE_AMPLITUDE_BY_STATUS: Record<NovaOrbStatus, number> = {
  idle: 0.012,
  ouvindo: 0.014,
  pensando: 0.018,
  executando: 0.024,
  respondendo: 0.024,
};
function silhouetteWobble(angle: number, t: number): number {
  return Math.sin(angle * 3 + t * 0.00035) * 0.6 + Math.sin(angle * 5 - t * 0.0006) * 0.4;
}

/** Distribuição uniforme de pontos numa esfera (evita acúmulo nos polos). */
function createShellPoints(count: number): OrbPoint[] {
  return Array.from({ length: count }, () => ({
    phi: Math.acos(1 - 2 * Math.random()),
    theta: Math.random() * Math.PI * 2,
    seed: Math.random() * 1000,
    spinFactor: 0.82 + Math.random() * 0.36,
    sizeFactor: 0.7 + Math.random() * 0.6,
  }));
}

export interface NovaOrbProps {
  /** Velocidade de rotação — espelha o estado da conversa (ver `NovaThinkingStatus`). */
  status?: NovaOrbStatus;
  className?: string;
  /**
   * Incrementa a cada fronteira de palavra falada (CONTROL OS — Etapa 11:
   * "fala → pulsa conforme as palavras") — ver `VoiceProviderHandlers.onBoundary`.
   * Opcional: sem isso, a orb continua respirando/girando normalmente, só
   * sem o pulso extra sincronizado à fala. Quando `status === 'respondendo'`,
   * cada incremento também nasce uma onda circular própria e acende o glow
   * por um instante (ver `wavesRef`/`PULSE_GLOW_BOOST`).
   */
  pulseSignal?: number;
  /**
   * CONTROL OS — Etapa 15 (LEGENDARY): qual identidade a esfera representa
   * agora — `'nova'` (padrão) é roxo/azul, enérgica, tecnológica;
   * `'legendary'` é dourado/âmbar, fluida, contemplativa. Trocar este valor
   * NUNCA reinicia a animação (mesmo `canvas`, mesmo loop, mesmos
   * partículas) — só desloca `personaBlend` suavemente em ~600ms na direção
   * do novo alvo (ver `PERSONA_BLEND_EASE`), igual à inclinação/rotação já
   * fazem ao trocar de `status`.
   */
  persona?: NovaPersona;
}

/**
 * NovaOrb — esfera de partículas que representa a presença da Nova
 * (CONTROL OS — Etapa 3; overhaul visual completo na Etapa 10A — Premium
 * Visual Identity; Etapa 12 — NOVA Living Entity; refinamento na Etapa 11B
 * — Premium Visual Polish). Gira mais rápido conforme o estado (idle →
 * pensando → executando na conversa) e respira, pulsa em ondas e ganha
 * profundidade em camadas — "transmitir sensação de inteligência viva,
 * nunca parecer um loader/GIF/componente".
 *
 * Camadas do efeito, todas em cima da mesma base: 3 camadas de pontos
 * girando e respirando em ritmos próprios (em vez de uma nuvem rígida
 * única), jitter individual por ponto — raio, latitude, brilho e opacidade
 * ("nunca todos iguais, nunca sincronizados") —, um núcleo com pulso de
 * "batimento" muito suave (duas batidas por ciclo, quase imperceptível, não
 * um LED piscando), uma casca de vidro translúcido com brilho de borda
 * (Fresnel simplificado) cuja silhueta é levemente deformada por ruído (a
 * borda nunca fica um círculo geométrico perfeito), inclinação sutil quando
 * `status === 'ouvindo'` (o movimento desacelera e as partículas "prestam
 * atenção" — jitter menor, não maior), partículas emitidas pra fora quando
 * `status === 'executando'`, glow que acompanha o pulso de fala em
 * `'respondendo'`, reflexo que desliza lentamente pela superfície, halo
 * externo enorme e sem borda perceptível (o próprio halo "respira" — escala
 * e opacidade variam por frame, não é um blur CSS estático) e flutuação
 * constante mesmo em repouso (nunca perfeitamente parada).
 *
 * Continua Canvas 2D com projeção esférica manual (sem Three.js/WebGL/
 * Babylon — decisão explícita: o sandbox de desenvolvimento também não tem
 * acesso ao registry do npm pra instalar uma dependência nova, então toda
 * evolução do efeito é matemática pura em cima do que já existe, "extrair o
 * máximo possível do Canvas 2D"). O canvas em si nunca desenha nenhum fundo
 * — só `clearRect` + a esfera; o halo (blur real, "luz, não um círculo") é
 * puro CSS por trás do canvas, mais barato que redesenhar blur no canvas a
 * cada frame. Respeita `prefers-reduced-motion` (renderiza um frame único
 * estático, sem flutuação/inclinação/partículas/halo animado) e pausa via
 * `visibilitychange`, igual ao `BackgroundNetwork`.
 *
 * CONTROL OS — Etapa 15 (LEGENDARY): a mesma esfera representa as duas
 * personas do ecossistema — nunca dois componentes, nunca dois canvas.
 * `persona` só desloca `personaBlend` (0 = NOVA, 1 = LEGENDARY) suavemente
 * em ~600ms (`PERSONA_BLEND_EASE`) na direção do novo alvo, e cada
 * parâmetro já existente (cor, velocidade de rotação, respiração, jitter,
 * batimento, intervalo das ondas, silhueta) é interpolado por esse valor —
 * nunca uma segunda tabela de comportamento paralela à dos `status`. O
 * resultado: a mesma "criatura" muda de temperamento (mais enérgica e
 * tecnológica na NOVA, mais fluida e contemplativa na LEGENDARY) e de cor
 * (roxo/azul → dourado/âmbar) sem nunca reiniciar, remontar ou parecer um
 * corte entre dois chatbots diferentes.
 */
export function NovaOrb({ status = 'idle', className, pulseSignal, persona = 'nova' }: NovaOrbProps) {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const haloRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  // Ref de "último valor" — evita recriar o efeito (e o loop de animação)
  // toda vez que `status` muda durante a conversa.
  const statusRef = React.useRef(status);
  statusRef.current = status;

  // Mesmo padrão pra `persona` (CONTROL OS — Etapa 15) — trocar de NOVA pra
  // LEGENDARY nunca recria o loop de animação, só move `personaBlend` (ver
  // dentro do efeito abaixo) suavemente na direção do novo alvo.
  const personaRef = React.useRef(persona);
  personaRef.current = persona;

  // Ondas nascidas por temporizador (loop de animação) E por fronteira de
  // palavra (efeito separado abaixo) precisam do mesmo array — por isso vive
  // num ref compartilhado, não numa variável local de um único efeito.
  const wavesRef = React.useRef<OrbWave[]>([]);

  // Mesma técnica pro pulso de fala: `lastPulseAtRef` é lido dentro do loop
  // de animação (closure sobre o ref, não sobre o valor), e escrito por este
  // efeito separado sempre que `pulseSignal` muda — nunca recria o loop.
  const lastPulseSignalRef = React.useRef(pulseSignal);
  const lastPulseAtRef = React.useRef(0);
  React.useEffect(() => {
    if (pulseSignal !== undefined && pulseSignal !== lastPulseSignalRef.current) {
      lastPulseSignalRef.current = pulseSignal;
      const now = performance.now();
      lastPulseAtRef.current = now;
      // "Cada frase gera pequenas ondas" — uma onda nova por fronteira de
      // fala, só enquanto a NOVA está de fato falando.
      if (statusRef.current === 'respondendo') {
        wavesRef.current = [...wavesRef.current, { bornAt: now }];
      }
    }
  }, [pulseSignal]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let frameId = 0;
    let lastFrameTime = 0;
    let currentRotationSpeed = ROTATION_SPEED.idle;
    let shellAngles = SHELLS.map(() => 0);
    let breathePhase = 0;
    let tiltAngle = 0;
    let highlightAngle = 0;
    let nextWaveAt = 0;
    let bursts: OrbBurst[] = [];
    let nextBurstAt = 0;
    // CONTROL OS — Etapa 15 (LEGENDARY): 0 = NOVA pura, 1 = LEGENDARY pura.
    // Começa já no valor final da persona atual (nunca anima na primeira
    // pintura, só quando `persona` de fato muda depois de montado — ver
    // `step()` abaixo).
    let personaBlend = personaRef.current === 'legendary' ? 1 : 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const shellPoints = SHELLS.map((shell) => createShellPoints(Math.max(1, Math.round(POINT_COUNT * shell.pointShare))));

    // Arrow functions (não `function` hoisted) preservam o estreitamento de
    // tipo de `canvas`/`ctx` dos `if (!x) return` acima — mesmo motivo
    // documentado em `BackgroundNetwork`.
    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawFrame = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const baseRadius = Math.min(width, height) / 2.4;
      const currentStatus = statusRef.current;
      // CONTROL OS — Etapa 15 (LEGENDARY): a cor de todo o efeito (glow,
      // vidro, núcleo, ondas) é interpolada frame a frame entre a cor da
      // NOVA e a da LEGENDARY conforme `personaBlend` avança — nunca um
      // corte seco de cor de um frame pro outro.
      const listeningNow = currentStatus === 'ouvindo';
      const novaGlowRgb = listeningNow ? PERSONA_LISTENING_GLOW_RGB.nova : PERSONA_BASE_GLOW_RGB.nova;
      const legendaryGlowRgb = listeningNow ? PERSONA_LISTENING_GLOW_RGB.legendary : PERSONA_BASE_GLOW_RGB.legendary;
      const glowRgb = lerpRgb(novaGlowRgb, legendaryGlowRgb, personaBlend);
      const pointColorRgb = lerpRgb(PERSONA_POINT_COLOR_RGB.nova, PERSONA_POINT_COLOR_RGB.legendary, personaBlend);

      // CONTROL OS — Etapa 11D: segunda camada de proteção contra o
      // "quadrado perceptível", além de conter cada gradiente ao seu
      // próprio raio (ver `outerGlow`/`coreGlow` abaixo). Um clip circular
      // no maior círculo que cabe dentro do canvas (sempre um elemento
      // quadrado) torna IMPOSSÍVEL qualquer pixel — glow, onda, partícula
      // de burst, reflexo — ser desenhado nos cantos, mesmo que um ajuste
      // futuro de raio erre a conta de novo. `ctx.restore()` no fim de
      // `drawFrame` remove o clip antes do próximo frame.
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(width, height) / 2, 0, Math.PI * 2);
      ctx.clip();

      // Respiração: o próprio raio da esfera oscila, não só o container CSS
      // por fora — é isso que faz a orb parecer respirando de dentro pra
      // fora, não só "crescendo". Amplitude escalada por persona — a
      // LEGENDARY respira mais amplo e mais devagar (`breatheSpeed`, usado
      // em `step()`), "mais fluida, contemplativa".
      const breatheAmplitude = BREATHE_AMPLITUDE_BY_STATUS[currentStatus] * personaMultiplier('breatheAmplitude', personaBlend);
      const breatheFactor = 1 + Math.sin(breathePhase) * breatheAmplitude;

      // Pulso de fala: decai linearmente nos primeiros `PULSE_DURATION_MS`
      // depois da última fronteira de palavra reportada, depois some. Move
      // tanto o raio quanto o glow (Etapa 11B: "o glow deve acompanhar a
      // voz").
      const sincePulse = time - lastPulseAtRef.current;
      const pulseFraction = sincePulse >= 0 && sincePulse < PULSE_DURATION_MS ? 1 - sincePulse / PULSE_DURATION_MS : 0;
      const pulseBoost = pulseFraction * PULSE_BOOST;
      const pulseGlowBoost = pulseFraction * PULSE_GLOW_BOOST;

      const radius = baseRadius * RADIUS_SCALE_BY_STATUS[currentStatus] * breatheFactor * (1 + pulseBoost);
      const silhouetteAmplitude = SILHOUETTE_AMPLITUDE_BY_STATUS[currentStatus] * personaMultiplier('silhouette', personaBlend);

      // Camada 1 — halo externo amplo e difuso, desenhado só como reforço
      // sutil (o halo "de verdade" — enorme, sem borda — é o CSS por trás do
      // canvas; isto aqui só ilumina discretamente a área imediatamente ao
      // redor da esfera dentro do próprio canvas).
      //
      // CONTROL OS — Etapa 11D: esta é a causa raiz do "quadrado
      // perceptível" relatado. O raio externo do gradiente (antes `radius *
      // 2.2`) chegava a ultrapassar a distância até os CANTOS do canvas
      // (que é sempre um elemento quadrado) — e como `fillRect` pintava o
      // retângulo inteiro, os 4 cantos recebiam uma tinta residual (~3-4%
      // de opacidade) que o resto do fundo, fora do canvas, não tinha. Um
      // gradiente radial, mesmo suave, sempre acaba formando essa "vinheta
      // quadrada" se o raio onde ele chega a opacidade zero for maior que a
      // diagonal do próprio elemento. Corrigido reduzindo o raio externo
      // pra bem menos que a distância até os cantos em qualquer estado (o
      // pior caso — 'ouvindo' respirando no pico — ainda fica width abaixo
      // do limite) — a opacidade agora chega a zero bem antes dos cantos,
      // em vez de só no limite teórico do gradiente.
      const outerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.3);
      outerGlow.addColorStop(0, `rgba(${glowRgb}, ${(0.1 + pulseGlowBoost * 0.4).toFixed(3)})`);
      outerGlow.addColorStop(1, `rgba(${glowRgb}, 0)`);
      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // Camada 2 — "material translúcido" (vidro líquido): preenchimento
      // com silhueta levemente deformada por ruído (nunca um círculo
      // geométrico perfeito — "como um organismo respirando") e um brilho
      // de borda suave simulando refração — mais claro perto da borda do
      // que no centro, sem nunca virar um anel nítido.
      // CONTROL OS — Etapa 16B: casca de vidro é uma característica da
      // NOVA (esfera orgânica) — desvanece conforme `personaBlend` avança
      // pra LEGENDARY, dando lugar ao cristal facetado (desenhado abaixo,
      // depois do núcleo). `globalAlpha` some, nunca um corte seco.
      ctx.save();
      ctx.globalAlpha = 1 - personaBlend;
      ctx.beginPath();
      for (let i = 0; i <= SILHOUETTE_SEGMENTS; i += 1) {
        const angle = (i / SILHOUETTE_SEGMENTS) * Math.PI * 2;
        const wobble = 1 + silhouetteWobble(angle, time) * silhouetteAmplitude;
        const x = cx + Math.cos(angle) * radius * wobble;
        const y = cy + Math.sin(angle) * radius * wobble * DEPTH_SQUASH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const glass = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.04);
      glass.addColorStop(0, `rgba(${glowRgb}, 0.045)`);
      glass.addColorStop(0.6, `rgba(${glowRgb}, 0.025)`);
      glass.addColorStop(0.82, 'rgba(255, 255, 255, 0.03)');
      glass.addColorStop(0.93, 'rgba(255, 255, 255, 0.08)');
      glass.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = glass;
      ctx.fill();
      ctx.restore();

      // Camada 3 — núcleo com pulso de batimento, muito suave ("quase
      // imperceptível" — duas batidas por ciclo, nunca um brilho contínuo
      // nem um LED piscando).
      const heartbeatPeriod = HEARTBEAT_PERIOD_MS_BY_STATUS[currentStatus];
      const heartbeatPhase = (time % heartbeatPeriod) / heartbeatPeriod;
      const heartbeatValue = heartbeatPulse(heartbeatPhase);
      const coreOpacity = Math.min(
        0.42,
        0.16 +
          breatheFactor * 0.04 +
          heartbeatValue * HEARTBEAT_INTENSITY_BY_STATUS[currentStatus] * personaMultiplier('heartbeat', personaBlend) +
          pulseGlowBoost
      );
      const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.1);
      coreGlow.addColorStop(0, `rgba(${glowRgb}, ${coreOpacity.toFixed(3)})`);
      coreGlow.addColorStop(1, `rgba(${glowRgb}, 0)`);
      ctx.fillStyle = coreGlow;
      // Mesmo raciocínio do halo externo acima — preenche só o círculo onde
      // o gradiente de fato tem cor, nunca o retângulo inteiro do canvas.
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.1, 0, Math.PI * 2);
      ctx.fill();

      // CONTROL OS — Etapa 16B (LEGENDARY): cristal facetado — desenhado
      // por cima do núcleo (a luz interna ilumina o sólido por trás) e
      // antes das ondas/reflexo (que continuam por cima, compartilhados
      // entre as duas personas). Faces triangulares planas, sombreadas por
      // uma direção de luz fixa (nunca a nuvem de pontos da NOVA) — ver
      // `CRYSTAL_GEOMETRY`/`buildCrystalGeometry` acima. Reaproveita
      // `shellAngles[0]`/`tiltAngle`, os mesmos estados que já giram e
      // inclinam a esfera — nunca uma segunda física paralela. Só
      // desenhado quando `personaBlend` já saiu de zero (evita trabalho
      // por frame na NOVA pura) e sempre com `globalAlpha = personaBlend`
      // — crossfade puro contra a esfera, nunca um corte seco.
      if (personaBlend > 0.001) {
        const rotY = shellAngles[0] ?? 0;
        const cosRot = Math.cos(rotY);
        const sinRot = Math.sin(rotY);
        const cosTilt = Math.cos(tiltAngle);
        const sinTilt = Math.sin(tiltAngle);

        const transformed = CRYSTAL_GEOMETRY.vertices.map(([vx, vy, vz]) => {
          const rx = vx * cosRot + vz * sinRot;
          const rz = -vx * sinRot + vz * cosRot;
          const ty = vy * cosTilt - rz * sinTilt;
          const tz = vy * sinTilt + rz * cosTilt;
          return [rx, ty, tz] as const;
        });

        const facesWithDepth = CRYSTAL_GEOMETRY.faces.map((face) => {
          const [i0, i1, i2] = face.indices;
          const v0 = transformed[i0] ?? [0, 0, 0];
          const v1 = transformed[i1] ?? [0, 0, 0];
          const v2 = transformed[i2] ?? [0, 0, 0];
          const centroid: [number, number, number] = [
            (v0[0] + v1[0] + v2[0]) / 3,
            (v0[1] + v1[1] + v2[1]) / 3,
            (v0[2] + v1[2] + v2[2]) / 3,
          ];
          let normal = normalize3(cross3(sub3(v1, v0), sub3(v2, v0)));
          if (dot3(normal, centroid) < 0) normal = [-normal[0], -normal[1], -normal[2]];
          // Piso de 0.25 — mesmo em faces de sombra plena, o metal nunca
          // vira preto chapado ("iluminação de vitrine", nunca um recorte).
          const lambert = Math.max(0, dot3(normal, CRYSTAL_LIGHT_DIR)) * 0.75 + 0.25;
          return { v0, v1, v2, depth: centroid[2], lambert };
        });
        facesWithDepth.sort((a, b) => a.depth - b.depth);

        ctx.save();
        ctx.globalAlpha = personaBlend;
        for (const face of facesWithDepth) {
          const shade = lerpRgb(CRYSTAL_SHADE_DARK_RGB, CRYSTAL_SHADE_BRIGHT_RGB, Math.min(1, face.lambert));
          const p0 = { x: cx + face.v0[0] * radius, y: cy + face.v0[1] * radius * DEPTH_SQUASH };
          const p1 = { x: cx + face.v1[0] * radius, y: cy + face.v1[1] * radius * DEPTH_SQUASH };
          const p2 = { x: cx + face.v2[0] * radius, y: cy + face.v2[1] * radius * DEPTH_SQUASH };
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.closePath();
          ctx.fillStyle = `rgba(${shade}, 0.92)`;
          ctx.fill();
          // Aresta com aceso dourado — "gold edge lighting" da referência —
          // mais forte nas faces já mais claras (reforça o volume, nunca
          // um contorno uniforme tipo cartoon).
          ctx.strokeStyle = `rgba(${glowRgb}, ${(0.22 + face.lambert * 0.28).toFixed(3)})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
        ctx.restore();
      }

      // Ondas de energia — anéis nascendo e se dissolvendo (por temporizador
      // e por palavra falada, ver `wavesRef`).
      for (const wave of wavesRef.current) {
        const age = time - wave.bornAt;
        const lifeFraction = age / WAVE_LIFETIME_MS;
        if (lifeFraction >= 1) continue;
        const waveRadius = radius * (1 + lifeFraction * WAVE_MAX_EXPANSION);
        const waveOpacity = (1 - lifeFraction) * 0.16;
        ctx.strokeStyle = `rgba(${glowRgb}, ${waveOpacity.toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, waveRadius, waveRadius * DEPTH_SQUASH, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Inclinação (rotação em torno do eixo X) — só diferente de zero
      // enquanto 'ouvindo', eased em `step()`. Aplicada a todas as camadas
      // antes de projetar, junto do jitter individual de cada ponto (raio,
      // latitude, brilho e opacidade — "nunca todos iguais, nunca
      // sincronizados").
      const tSeconds = time / 1000;
      const brightness = POINT_BRIGHTNESS_BY_STATUS[currentStatus];
      const projected: { x: number; y: number; z: number; size: number; opacity: number }[] = [];

      const jitterMultiplier = personaMultiplier('jitter', personaBlend);
      SHELLS.forEach((shell, shellIndex) => {
        const shellBreathe = 1 + Math.sin(breathePhase * 0.8 + shell.breathePhaseOffset) * breatheAmplitude * 0.3;
        const shellRadius = radius * shell.radiusFraction * shellBreathe;
        const angle = shellAngles[shellIndex] ?? 0;
        for (const point of shellPoints[shellIndex] ?? []) {
          const jitter = pseudoNoise(point.seed, tSeconds);
          const jitteredRadius = shellRadius * (1 + jitter * JITTER_RADIUS_AMPLITUDE_BY_STATUS[currentStatus] * shell.jitterScale * jitterMultiplier);
          const phi = point.phi + jitter * JITTER_PHI_AMPLITUDE_BY_STATUS[currentStatus] * shell.jitterScale * jitterMultiplier * 0.4;

          // "Velocidade diferente" por partícula (Etapa 11C) — cada ponto
          // aplica `spinFactor` sobre o próprio ângulo da camada, então dois
          // pontos na mesma camada nunca giram exatamente juntos.
          const pointAngle = angle * point.spinFactor;
          const x0 = Math.sin(phi) * Math.cos(point.theta + pointAngle);
          const z0 = Math.sin(phi) * Math.sin(point.theta + pointAngle);
          const y0 = Math.cos(phi);

          // Rotação em X (inclinação) — combina y0/z0.
          const y1 = y0 * Math.cos(tiltAngle) - z0 * Math.sin(tiltAngle);
          const z1 = y0 * Math.sin(tiltAngle) + z0 * Math.cos(tiltAngle);

          const depth = (z1 + 1) / 2; // 0 (fundo) .. 1 (frente)
          // Brilho/opacidade individuais — cada ponto pisca ligeiramente
          // fora de fase dos outros, nunca em uníssono.
          const flicker = 0.85 + pseudoNoise(point.seed * 2.3 + 500, tSeconds * 0.6) * 0.15;
          projected.push({
            x: cx + x0 * jitteredRadius,
            y: cy + y1 * jitteredRadius * DEPTH_SQUASH,
            z: z1,
            size: (0.6 + depth * 1.8) * shell.sizeScale * point.sizeFactor,
            opacity: (0.1 + depth * 0.6) * shell.opacityScale * flicker,
          });
        }
      });

      // Desenha de trás pra frente — profundidade visual sem WebGL.
      // CONTROL OS — Etapa 16B: a nuvem de pontos é a identidade da NOVA —
      // some conforme `personaBlend` avança pro cristal da LEGENDARY
      // (desenhado acima), mesmo crossfade de `globalAlpha` da casca de
      // vidro.
      projected.sort((a, b) => a.z - b.z);
      ctx.save();
      ctx.globalAlpha = 1 - personaBlend;
      for (const point of projected) {
        ctx.fillStyle = `rgba(${pointColorRgb}, ${Math.min(1, point.opacity * brightness).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Partículas emitidas pra fora — só enquanto 'executando' ("emite
      // partículas para os lados, como se estivesse enviando comandos").
      for (const burst of bursts) {
        const lifeFraction = (time - burst.bornAt) / BURST_LIFETIME_MS;
        if (lifeFraction >= 1) continue;
        const dist = radius * (1 + lifeFraction * 0.85);
        const opacity = (1 - lifeFraction) * 0.5;
        const bx = cx + Math.cos(burst.angle) * dist;
        const by = cy + Math.sin(burst.angle) * dist * DEPTH_SQUASH;
        ctx.fillStyle = `rgba(${pointColorRgb}, ${opacity.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(bx, by, 1.5 * (1 - lifeFraction * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }

      // Reflexo — desliza lentamente pela superfície em vez de ficar fixo
      // ("reflexos dinâmicos, discretos, como vidro premium").
      const highlightAnchorX = cx - radius * 0.32;
      const highlightAnchorY = cy - radius * 0.38;
      const highlightX = highlightAnchorX + Math.cos(highlightAngle) * radius * 0.14;
      const highlightY = highlightAnchorY + Math.sin(highlightAngle * 0.8) * radius * 0.1;
      const highlight = ctx.createRadialGradient(highlightX, highlightY, 0, highlightX, highlightY, radius * 0.5);
      highlight.addColorStop(0, 'rgba(255, 255, 255, 0.09)');
      highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = highlight;
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius * 1.05, radius * 1.05 * DEPTH_SQUASH, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore(); // fecha o clip circular aberto no início da função

      // CONTROL OS — Etapa 15 (LEGENDARY): halo externo em CSS (fora do
      // canvas) escrito a cada frame com o MESMO `glowRgb` já calculado
      // acima — nunca uma segunda lógica de cor. Antes o terceiro stop do
      // gradiente era um azul fixo (`rgba(99, 141, 246, 0.05)`) independente
      // do estado/persona; agora usa a mesma cor interpolada dos outros
      // stops — halo mais coerente, e a única forma de fazer a cor do halo
      // (que é puro CSS, fora do canvas) acompanhar a transição suave de
      // ~600ms entre NOVA e LEGENDARY sem depender de re-render do React.
      if (haloRef.current) {
        haloRef.current.style.background = `radial-gradient(circle, rgba(${glowRgb}, 0.16), rgba(${glowRgb}, 0.08) 28%, rgba(${glowRgb}, 0.05) 52%, transparent 78%)`;
      }
    };

    const step = (time: number) => {
      if (time - lastFrameTime < TARGET_FRAME_MS) {
        frameId = window.requestAnimationFrame(step);
        return;
      }
      lastFrameTime = time;

      const currentStatus = statusRef.current;

      // CONTROL OS — Etapa 15 (LEGENDARY): move `personaBlend` uma fração do
      // caminho até o alvo a cada frame — mesma técnica de
      // `currentRotationSpeed`/`tiltAngle` abaixo — nunca um salto de um
      // frame pro outro, ~600ms pra completar a transição inteira.
      const personaTarget = personaRef.current === 'legendary' ? 1 : 0;
      personaBlend += (personaTarget - personaBlend) * PERSONA_BLEND_EASE;

      const targetSpeed = ROTATION_SPEED[currentStatus] * personaMultiplier('rotation', personaBlend);
      currentRotationSpeed += (targetSpeed - currentRotationSpeed) * ROTATION_EASE;
      shellAngles = SHELLS.map((shell, index) => (shellAngles[index] ?? 0) + currentRotationSpeed * shell.rotationMultiplier);
      breathePhase += BREATHE_SPEED_BY_STATUS[currentStatus] * personaMultiplier('breatheSpeed', personaBlend);
      highlightAngle += 0.0016;

      const tiltTarget = TILT_TARGET_BY_STATUS[currentStatus];
      tiltAngle += (tiltTarget - tiltAngle) * TILT_EASE;

      if (time >= nextWaveAt) {
        wavesRef.current = [...wavesRef.current, { bornAt: time }];
        nextWaveAt = time + WAVE_INTERVAL_MS[currentStatus] * personaMultiplier('waveInterval', personaBlend);
      }
      wavesRef.current = wavesRef.current.filter((wave) => time - wave.bornAt < WAVE_LIFETIME_MS);

      if (currentStatus === 'executando') {
        if (time >= nextBurstAt) {
          bursts = [...bursts, { bornAt: time, angle: Math.random() * Math.PI * 2 }];
          nextBurstAt = time + (BURST_INTERVAL_MS + Math.random() * 120) * personaMultiplier('burstInterval', personaBlend);
        }
      }
      bursts = bursts.filter((burst) => time - burst.bornAt < BURST_LIFETIME_MS);

      // Flutuação constante — "nunca deveria ficar parada, mesmo parada.
      // Respira. Sobe lentamente. Desce lentamente." Aplicada no wrapper
      // (fora do canvas), não no raio — é um deslocamento vertical do
      // organismo inteiro, distinto da respiração do próprio corpo da
      // esfera.
      if (wrapperRef.current) {
        const floatOffset = Math.sin(time * 0.0006) * 3;
        wrapperRef.current.style.transform = `translateY(${floatOffset.toFixed(2)}px)`;
      }

      // O halo CSS também "respira" — Etapa 11B: "o glow deve respirar,
      // aumentar, diminuir... sem parecer um efeito CSS estático." Escala e
      // opacidade variam junto da própria respiração da esfera. A cor em si
      // é escrita dentro de `drawFrame` (mesmo `glowRgb` já calculado lá
      // pro canvas) — ver comentário no final de `drawFrame`.
      if (haloRef.current) {
        const haloBreathe = 1 + Math.sin(breathePhase * 0.5) * 0.05;
        const haloOpacity = 0.85 + Math.sin(breathePhase * 0.5) * 0.15;
        haloRef.current.style.transform = `scale(${haloBreathe.toFixed(3)})`;
        haloRef.current.style.opacity = haloOpacity.toFixed(3);
      }

      drawFrame(time);
      frameId = window.requestAnimationFrame(step);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(frameId);
      } else if (!prefersReducedMotion) {
        lastFrameTime = 0;
        frameId = window.requestAnimationFrame(step);
      }
    };

    resize();
    drawFrame(0);

    if (!prefersReducedMotion) {
      frameId = window.requestAnimationFrame(step);
    }

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [prefersReducedMotion]);

  // Valor inicial só pra pré-pintura (antes do efeito de animação assumir o
  // controle do `haloRef.current.style.background` a cada frame, ver fim de
  // `drawFrame` acima) — usa a cor da persona/status atuais sem nenhuma
  // interpolação (a transição suave só existe DEPOIS de montado, quando
  // `personaBlend` passa a existir).
  const initialListening = status === 'ouvindo';
  const initialGlowTuple = initialListening ? PERSONA_LISTENING_GLOW_RGB[persona] : PERSONA_BASE_GLOW_RGB[persona];
  const haloColorRgb = `${initialGlowTuple[0]}, ${initialGlowTuple[1]}, ${initialGlowTuple[2]}`;

  return (
    <div ref={wrapperRef} className={`relative ${className ?? 'h-full w-full'}`} aria-hidden>
      {/* Sombra de contato — extremamente suave, "como se estivesse
          flutuando". CONTROL OS — Etapa 11C: era um `div` sólido com
          `rounded-full` sobre um retângulo muito achatado — isso produz uma
          "pílula" de bordas retas, não uma elipse suave (provável origem do
          "quadrado perceptível" relatado). Agora é um gradiente radial puro
          (`ellipse`, se molda à caixa automaticamente) que já chega a 0 de
          opacidade bem antes da borda do elemento — nunca uma aresta
          geométrica visível. Estática (a flutuação já é comunicada pelo
          próprio wrapper subindo/descendo por cima dela). */}
      <div
        className="absolute inset-x-[10%] bottom-[-10%] h-[22%] blur-2xl"
        style={{ background: 'radial-gradient(ellipse, rgba(0, 0, 0, 0.32), transparent 70%)' }}
      />
      {/* Halo externo em CSS puro (blur real, não redesenhado no canvas a
          cada frame) — "enorme, sem bordas, sem círculos visíveis, apenas
          luz". Gradiente em múltiplos estágios suaves (nunca dois stops só,
          que criam uma faixa/banda visível) pra nunca ler como um círculo
          colorido, escala/opacidade/cor animadas por `haloRef` (respira
          junto da esfera e cruza suavemente entre a cor da NOVA e da
          LEGENDARY, nunca um blur CSS parado — ver fim de `drawFrame`
          acima). O `background` abaixo é só o valor inicial antes do
          primeiro frame do efeito de animação assumir. */}
      <div
        ref={haloRef}
        className="absolute inset-[-60%] rounded-full blur-[64px]"
        style={{
          background: `radial-gradient(circle, rgba(${haloColorRgb}, 0.16), rgba(${haloColorRgb}, 0.08) 28%, rgba(${haloColorRgb}, 0.05) 52%, transparent 78%)`,
        }}
      />
      {/* O canvas em si nunca desenha nenhum fundo — só `clearRect` + a
          esfera — "não pode existir nenhum limite visual entre ela e o
          background". */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full bg-transparent" />
    </div>
  );
}
