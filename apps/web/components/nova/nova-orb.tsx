'use client';

import * as React from 'react';
import { useMediaQuery } from '@control-os/hooks';

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

const GLOW_COLOR_BY_STATUS: Record<NovaOrbStatus, string> = {
  // Roxo é a cor de base da NOVA em todo o resto do produto (accent-purple)
  // — só 'ouvindo' recebe um tom azulado, ecoando os nós de destaque do
  // `BackgroundNetwork` e reforçando "está escutando" sem introduzir uma
  // terceira cor à identidade.
  idle: '139, 92, 246',
  pensando: '139, 92, 246',
  executando: '139, 92, 246',
  respondendo: '139, 92, 246',
  ouvindo: '99, 141, 246',
};

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
 */
export function NovaOrb({ status = 'idle', className, pulseSignal }: NovaOrbProps) {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const haloRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  // Ref de "último valor" — evita recriar o efeito (e o loop de animação)
  // toda vez que `status` muda durante a conversa.
  const statusRef = React.useRef(status);
  statusRef.current = status;

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
      const glowRgb = GLOW_COLOR_BY_STATUS[currentStatus];

      // Respiração: o próprio raio da esfera oscila, não só o container CSS
      // por fora — é isso que faz a orb parecer respirando de dentro pra
      // fora, não só "crescendo".
      const breatheFactor = 1 + Math.sin(breathePhase) * BREATHE_AMPLITUDE_BY_STATUS[currentStatus];

      // Pulso de fala: decai linearmente nos primeiros `PULSE_DURATION_MS`
      // depois da última fronteira de palavra reportada, depois some. Move
      // tanto o raio quanto o glow (Etapa 11B: "o glow deve acompanhar a
      // voz").
      const sincePulse = time - lastPulseAtRef.current;
      const pulseFraction = sincePulse >= 0 && sincePulse < PULSE_DURATION_MS ? 1 - sincePulse / PULSE_DURATION_MS : 0;
      const pulseBoost = pulseFraction * PULSE_BOOST;
      const pulseGlowBoost = pulseFraction * PULSE_GLOW_BOOST;

      const radius = baseRadius * RADIUS_SCALE_BY_STATUS[currentStatus] * breatheFactor * (1 + pulseBoost);
      const silhouetteAmplitude = SILHOUETTE_AMPLITUDE_BY_STATUS[currentStatus];

      // Camada 1 — halo externo amplo e difuso, desenhado só como reforço
      // sutil (o halo "de verdade" — enorme, sem borda — é o CSS por trás do
      // canvas; isto aqui só ilumina discretamente a área imediatamente ao
      // redor da esfera dentro do próprio canvas).
      const outerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2.2);
      outerGlow.addColorStop(0, `rgba(${glowRgb}, ${(0.1 + pulseGlowBoost * 0.4).toFixed(3)})`);
      outerGlow.addColorStop(1, `rgba(${glowRgb}, 0)`);
      ctx.fillStyle = outerGlow;
      ctx.fillRect(0, 0, width, height);

      // Camada 2 — "material translúcido" (vidro líquido): preenchimento
      // com silhueta levemente deformada por ruído (nunca um círculo
      // geométrico perfeito — "como um organismo respirando") e um brilho
      // de borda suave simulando refração — mais claro perto da borda do
      // que no centro, sem nunca virar um anel nítido.
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

      // Camada 3 — núcleo com pulso de batimento, muito suave ("quase
      // imperceptível" — duas batidas por ciclo, nunca um brilho contínuo
      // nem um LED piscando).
      const heartbeatPeriod = HEARTBEAT_PERIOD_MS_BY_STATUS[currentStatus];
      const heartbeatPhase = (time % heartbeatPeriod) / heartbeatPeriod;
      const heartbeatValue = heartbeatPulse(heartbeatPhase);
      const coreOpacity = Math.min(
        0.42,
        0.16 + breatheFactor * 0.04 + heartbeatValue * HEARTBEAT_INTENSITY_BY_STATUS[currentStatus] + pulseGlowBoost
      );
      const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.1);
      coreGlow.addColorStop(0, `rgba(${glowRgb}, ${coreOpacity.toFixed(3)})`);
      coreGlow.addColorStop(1, `rgba(${glowRgb}, 0)`);
      ctx.fillStyle = coreGlow;
      ctx.fillRect(0, 0, width, height);

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

      SHELLS.forEach((shell, shellIndex) => {
        const shellBreathe = 1 + Math.sin(breathePhase * 0.8 + shell.breathePhaseOffset) * BREATHE_AMPLITUDE_BY_STATUS[currentStatus] * 0.3;
        const shellRadius = radius * shell.radiusFraction * shellBreathe;
        const angle = shellAngles[shellIndex] ?? 0;
        for (const point of shellPoints[shellIndex] ?? []) {
          const jitter = pseudoNoise(point.seed, tSeconds);
          const jitteredRadius = shellRadius * (1 + jitter * JITTER_RADIUS_AMPLITUDE_BY_STATUS[currentStatus] * shell.jitterScale);
          const phi = point.phi + jitter * JITTER_PHI_AMPLITUDE_BY_STATUS[currentStatus] * shell.jitterScale * 0.4;

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
      projected.sort((a, b) => a.z - b.z);
      for (const point of projected) {
        ctx.fillStyle = `rgba(196, 181, 253, ${Math.min(1, point.opacity * brightness).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Partículas emitidas pra fora — só enquanto 'executando' ("emite
      // partículas para os lados, como se estivesse enviando comandos").
      for (const burst of bursts) {
        const lifeFraction = (time - burst.bornAt) / BURST_LIFETIME_MS;
        if (lifeFraction >= 1) continue;
        const dist = radius * (1 + lifeFraction * 0.85);
        const opacity = (1 - lifeFraction) * 0.5;
        const bx = cx + Math.cos(burst.angle) * dist;
        const by = cy + Math.sin(burst.angle) * dist * DEPTH_SQUASH;
        ctx.fillStyle = `rgba(196, 181, 253, ${opacity.toFixed(3)})`;
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
    };

    const step = (time: number) => {
      if (time - lastFrameTime < TARGET_FRAME_MS) {
        frameId = window.requestAnimationFrame(step);
        return;
      }
      lastFrameTime = time;

      const currentStatus = statusRef.current;
      const targetSpeed = ROTATION_SPEED[currentStatus];
      currentRotationSpeed += (targetSpeed - currentRotationSpeed) * ROTATION_EASE;
      shellAngles = SHELLS.map((shell, index) => (shellAngles[index] ?? 0) + currentRotationSpeed * shell.rotationMultiplier);
      breathePhase += BREATHE_SPEED_BY_STATUS[currentStatus];
      highlightAngle += 0.0016;

      const tiltTarget = TILT_TARGET_BY_STATUS[currentStatus];
      tiltAngle += (tiltTarget - tiltAngle) * TILT_EASE;

      if (time >= nextWaveAt) {
        wavesRef.current = [...wavesRef.current, { bornAt: time }];
        nextWaveAt = time + WAVE_INTERVAL_MS[currentStatus];
      }
      wavesRef.current = wavesRef.current.filter((wave) => time - wave.bornAt < WAVE_LIFETIME_MS);

      if (currentStatus === 'executando') {
        if (time >= nextBurstAt) {
          bursts = [...bursts, { bornAt: time, angle: Math.random() * Math.PI * 2 }];
          nextBurstAt = time + BURST_INTERVAL_MS + Math.random() * 120;
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
      // opacidade variam junto da própria respiração da esfera.
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

  const haloColorRgb = GLOW_COLOR_BY_STATUS[status];

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
          colorido — roxo → azul → transparente, escala/opacidade animadas
          por `haloRef` (respira junto da esfera, não é um blur CSS parado). */}
      <div
        ref={haloRef}
        className="absolute inset-[-60%] rounded-full blur-[64px]"
        style={{
          background: `radial-gradient(circle, rgba(${haloColorRgb}, 0.16), rgba(${haloColorRgb}, 0.08) 28%, rgba(99, 141, 246, 0.05) 52%, transparent 78%)`,
        }}
      />
      {/* O canvas em si nunca desenha nenhum fundo — só `clearRect` + a
          esfera — "não pode existir nenhum limite visual entre ela e o
          background". */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full bg-transparent" />
    </div>
  );
}
