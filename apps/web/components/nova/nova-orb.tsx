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
}

interface OrbWave {
  bornAt: number;
}

const POINT_COUNT = 420;
const TARGET_FRAME_MS = 33; // ~30fps — mesmo orçamento de frame do BackgroundNetwork.

const ROTATION_SPEED: Record<NovaOrbStatus, number> = {
  idle: 0.0018,
  pensando: 0.004,
  executando: 0.009,
  // 'ouvindo' gira um pouco mais que idle — presença ativa, mas calma (a
  // NOVA está atenta, não processando). 'respondendo' usa a mesma
  // velocidade de 'executando' — ambos comunicam "a NOVA está fazendo algo
  // agora", só muda o rótulo/legenda mostrado ao lado.
  ouvindo: 0.003,
  respondendo: 0.009,
};

// CONTROL OS — Etapa 10A: "a orb deve transmitir sensação de inteligência
// viva. Nunca parecer um loader." A rotação já existia; o que faltava era
// RESPIRAÇÃO orgânica (não-linear, via seno) — mais rápida e um pouco mais
// ampla nos estados ativos, quase parada no ócio, nunca mecânica.
const BREATHE_SPEED_BY_STATUS: Record<NovaOrbStatus, number> = {
  idle: 0.018,
  ouvindo: 0.022,
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

// Velocidade de rotação muda suavemente (lerp) em vez de saltar na hora que
// `status` muda — "transições suaves" — sem isso, ir de 'idle' pra
// 'executando' fazia a esfera acelerar num corte seco de um frame pro outro.
const ROTATION_EASE = 0.06;

// Ondas de energia que nascem no centro e se dissolvem pra fora — "ondas...
// energia" pedidos explicitamente. Mais raras e quase imperceptíveis em
// repouso; um pouco mais presentes (nunca chamativas) enquanto a NOVA
// pensa/executa/responde/ouve.
const WAVE_LIFETIME_MS = 1800;
const WAVE_MAX_EXPANSION = 0.6; // fração do raio que a onda cresce até desaparecer
const WAVE_INTERVAL_MS: Record<NovaOrbStatus, number> = {
  idle: 6000,
  ouvindo: 4200,
  pensando: 2600,
  executando: 2600,
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

/** Distribuição uniforme de pontos numa esfera (evita acúmulo nos polos). */
function createPoints(count: number): OrbPoint[] {
  return Array.from({ length: count }, () => ({
    phi: Math.acos(1 - 2 * Math.random()),
    theta: Math.random() * Math.PI * 2,
  }));
}

export interface NovaOrbProps {
  /** Velocidade de rotação — espelha o estado da conversa (ver `NovaThinkingStatus`). */
  status?: NovaOrbStatus;
  className?: string;
}

/**
 * NovaOrb — esfera de partículas que representa a presença da Nova
 * (CONTROL OS — Etapa 3; overhaul visual completo na Etapa 10A — Premium
 * Visual Identity). Gira mais rápido conforme o estado (idle → pensando →
 * executando na conversa) e agora também respira, pulsa em ondas e ganha
 * profundidade em camadas — "transmitir sensação de inteligência viva,
 * nunca parecer um loader".
 *
 * Continua Canvas 2D com projeção esférica simples (sem Three.js/WebGL —
 * mesma abordagem leve do `BackgroundNetwork`, sem adicionar dependência
 * nova nem sacrificar performance). O halo externo (blur/profundidade) é
 * puro CSS por trás do canvas — mais barato que redesenhar blur no canvas a
 * cada frame. Respeita `prefers-reduced-motion` (renderiza um frame único
 * estático) e pausa via `visibilitychange`, igual ao `BackgroundNetwork`.
 */
export function NovaOrb({ status = 'idle', className }: NovaOrbProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  // Ref de "último valor" — evita recriar o efeito (e o loop de animação)
  // toda vez que `status` muda durante a conversa.
  const statusRef = React.useRef(status);
  statusRef.current = status;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let frameId = 0;
    let lastFrameTime = 0;
    let angle = 0;
    let currentRotationSpeed = ROTATION_SPEED.idle;
    let breathePhase = 0;
    let waves: OrbWave[] = [];
    let nextWaveAt = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const points = createPoints(POINT_COUNT);

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
      const glowRgb = GLOW_COLOR_BY_STATUS[statusRef.current];

      // Respiração: o próprio raio da esfera oscila, não só o container CSS
      // por fora — é isso que faz a orb parecer respirando de dentro pra
      // fora, não só "crescendo".
      const breatheFactor = 1 + Math.sin(breathePhase) * BREATHE_AMPLITUDE_BY_STATUS[statusRef.current];
      const radius = baseRadius * breatheFactor;

      // Camada 1 — halo externo amplo e difuso (profundidade).
      const outerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.9);
      outerGlow.addColorStop(0, `rgba(${glowRgb}, 0.14)`);
      outerGlow.addColorStop(1, `rgba(${glowRgb}, 0)`);
      ctx.fillStyle = outerGlow;
      ctx.fillRect(0, 0, width, height);

      // Camada 2 — núcleo mais denso, acompanha a respiração.
      const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.15);
      coreGlow.addColorStop(0, `rgba(${glowRgb}, ${(0.3 + breatheFactor * 0.08).toFixed(3)})`);
      coreGlow.addColorStop(1, `rgba(${glowRgb}, 0)`);
      ctx.fillStyle = coreGlow;
      ctx.fillRect(0, 0, width, height);

      // Ondas de energia — anéis nascendo e se dissolvendo.
      for (const wave of waves) {
        const age = time - wave.bornAt;
        const lifeFraction = age / WAVE_LIFETIME_MS;
        if (lifeFraction >= 1) continue;
        const waveRadius = radius * (1 + lifeFraction * WAVE_MAX_EXPANSION);
        const waveOpacity = (1 - lifeFraction) * 0.16;
        ctx.strokeStyle = `rgba(${glowRgb}, ${waveOpacity.toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, waveRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      const projected = points.map((point) => {
        const x0 = Math.sin(point.phi) * Math.cos(point.theta + angle);
        const z0 = Math.sin(point.phi) * Math.sin(point.theta + angle);
        const y0 = Math.cos(point.phi);
        return { x: cx + x0 * radius, y: cy + y0 * radius, z: z0 };
      });
      // Desenha de trás pra frente — profundidade visual sem WebGL.
      projected.sort((a, b) => a.z - b.z);

      for (const point of projected) {
        const depth = (point.z + 1) / 2; // 0 (fundo) .. 1 (frente)
        const size = 0.6 + depth * 1.8;
        const opacity = 0.15 + depth * 0.65;
        ctx.fillStyle = `rgba(196, 181, 253, ${opacity.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Reflexo — realce fixo (não gira com a esfera), como luz incidindo
      // sobre uma superfície polida. Sutil: "reflexo" pedido explicitamente,
      // mas nunca a ponto de parecer um brilho de plástico.
      const highlight = ctx.createRadialGradient(
        cx - radius * 0.32,
        cy - radius * 0.38,
        0,
        cx - radius * 0.32,
        cy - radius * 0.38,
        radius * 0.5
      );
      highlight.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
      highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = highlight;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.05, 0, Math.PI * 2);
      ctx.fill();
    };

    const step = (time: number) => {
      if (time - lastFrameTime < TARGET_FRAME_MS) {
        frameId = window.requestAnimationFrame(step);
        return;
      }
      lastFrameTime = time;

      const targetSpeed = ROTATION_SPEED[statusRef.current];
      currentRotationSpeed += (targetSpeed - currentRotationSpeed) * ROTATION_EASE;
      angle += currentRotationSpeed;
      breathePhase += BREATHE_SPEED_BY_STATUS[statusRef.current];

      if (time >= nextWaveAt) {
        waves.push({ bornAt: time });
        nextWaveAt = time + WAVE_INTERVAL_MS[statusRef.current];
      }
      waves = waves.filter((wave) => time - wave.bornAt < WAVE_LIFETIME_MS);

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

  return (
    <div className={`relative ${className ?? 'h-full w-full'}`} aria-hidden>
      {/* Halo externo em CSS puro (blur real, não redesenhado no canvas a
          cada frame) — "profundidade... blur... sombras", mais barato que
          simular blur dentro do Canvas 2D. */}
      <div className="absolute inset-[-20%] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.22),transparent_65%)] blur-2xl" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
