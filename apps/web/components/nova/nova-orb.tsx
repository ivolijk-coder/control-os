'use client';

import * as React from 'react';
import { useMediaQuery } from '@control-os/hooks';

export type NovaOrbStatus = 'idle' | 'pensando' | 'executando';

interface OrbPoint {
  theta: number; // longitude
  phi: number; // latitude (0..PI)
}

const POINT_COUNT = 420;
const TARGET_FRAME_MS = 33; // ~30fps — mesmo orçamento de frame do BackgroundNetwork.

const ROTATION_SPEED: Record<NovaOrbStatus, number> = {
  idle: 0.0018,
  pensando: 0.004,
  executando: 0.009,
};

const CORE_GLOW = 'rgba(139, 92, 246, 0.35)';

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
 * (CONTROL OS — Etapa 3, estilo inspirado em referência visual enviada
 * pelo usuário). Gira mais rápido conforme o estado (idle → pensando →
 * executando na conversa) — puramente decorativo, sem captura de voz/áudio
 * real (isso é IA real, fora do escopo desta fase).
 *
 * Canvas 2D com projeção esférica simples (sem Three.js/WebGL — mesma
 * abordagem leve do `BackgroundNetwork`, sem adicionar dependência nova).
 * Respeita `prefers-reduced-motion` (renderiza um frame único estático) e
 * pausa via `visibilitychange`, igual ao `BackgroundNetwork`.
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

    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) / 2.4;

      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.15);
      gradient.addColorStop(0, CORE_GLOW);
      gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

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
    };

    const step = (time: number) => {
      if (time - lastFrameTime < TARGET_FRAME_MS) {
        frameId = window.requestAnimationFrame(step);
        return;
      }
      lastFrameTime = time;
      angle += ROTATION_SPEED[statusRef.current];
      drawFrame();
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
    drawFrame();

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

  return <canvas ref={canvasRef} aria-hidden className={className ?? 'h-full w-full'} />;
}
