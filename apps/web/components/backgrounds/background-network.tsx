'use client';

import * as React from 'react';
import { useMediaQuery } from '@control-os/hooks';
import type { NovaPersona } from '@/services/nova';

interface NetworkNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const NODE_COLOR = 'rgba(161, 161, 170, 0.55)';
const LINE_COLOR_RGB = '255, 255, 255';
const GLOW_PURPLE = 'rgba(139, 92, 246, 0.55)';
const GLOW_BLUE = 'rgba(59, 130, 246, 0.55)';
// CONTROL OS — Etapa 16F (Art Direction — Orb como coração do sistema): par
// dourado dos dois tons de glow acima — mesmo papel que `GLOW_BLUE` cumpre
// pra `GLOW_PURPLE` (variação secundária dentro da MESMA identidade), só que
// do lado da LEGENDARY. Reaproveita os dois tons de dourado já definidos em
// `tailwind.config.ts` (`accent.gold`/`accent['gold-soft']`).
const GLOW_GOLD = 'rgba(217, 164, 85, 0.55)';
const GLOW_GOLD_SOFT = 'rgba(235, 199, 138, 0.55)';

const MAX_NODES = 46;
const MIN_NODES = 18;
const LINK_DISTANCE = 140;
// CONTROL OS — Etapa 10A: "partículas lentas... sensação de ambiente" —
// reduzida de 0.12 (mais nervosa) pra uma deriva quase parada, mais perto de
// poeira suspensa do que de um gráfico de rede se movendo.
const NODE_SPEED = 0.05;
const TARGET_FRAME_MS = 33; // ~30fps — leve o suficiente para não pesar no Lighthouse.
/** Raio do halo de glow (canvas `shadowBlur`) dos nós de destaque — custo desprezível, só ~3-4 nós por vez. */
const GLOW_NODE_SHADOW_BLUR = 10;

function createNodes(width: number, height: number): NetworkNode[] {
  const area = width * height;
  const count = Math.max(MIN_NODES, Math.min(MAX_NODES, Math.round(area / 26000)));
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * NODE_SPEED,
    vy: (Math.random() - 0.5) * NODE_SPEED,
  }));
}

/**
 * BackgroundNetwork — background vivo do CONTROL OS (Fase 2: Nova
 * Experience). Nós conectados por linhas finas, deriva lenta, glow
 * ambiente — inspirado na sensação de um sistema operacional inteligente,
 * nunca copiando nenhuma referência específica.
 *
 * Client-only por natureza (canvas + randomização): sempre montado via
 * `next/dynamic(..., { ssr: false })` para não afetar SSR/streaming. Respeita
 * `prefers-reduced-motion` — nesse caso renderiza um único frame estático,
 * sem loop de animação. Pausa via `visibilitychange` quando a aba não está
 * ativa, para não gastar CPU/bateria à toa.
 *
 * CONTROL OS — Etapa 16F (Art Direction — Orb como coração do sistema): os
 * "nós de destaque" (poeira com glow, ~1 a cada 7) trocam de roxo/azul pra
 * dourado/âmbar quando `persona === 'legendary'`. Antes eram sempre
 * roxo/azul em toda página autenticada, mesmo com a LEGENDARY conduzindo a
 * conversa — o fundo do produto inteiro nunca refletia qual identidade
 * estava ativa. Prop opcional (padrão `'nova'`) mantém retrocompatibilidade
 * com qualquer chamador que ainda não a passe.
 */
export function BackgroundNetwork({ className, persona = 'nova' }: { className?: string; persona?: NovaPersona }) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const isLegendary = persona === 'legendary';

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let nodes: NetworkNode[] = [];
    let frameId = 0;
    let lastFrameTime = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Arrow functions (em vez de `function` hoisted) preservam o
    // estreitamento de tipo de `canvas`/`ctx` feito pelos `if (!x) return`
    // acima — TypeScript não propaga esse estreitamento para dentro de
    // declarações de função tradicionais.
    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nodes = createNodes(width, height);
    };

    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        if (!a) continue;
        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          if (!b) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DISTANCE) {
            ctx.strokeStyle = `rgba(${LINE_COLOR_RGB}, ${(0.08 * (1 - dist / LINK_DISTANCE)).toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      nodes.forEach((node, index) => {
        const isGlowNode = index % 7 === 0;
        const color = isGlowNode
          ? isLegendary
            ? index % 14 === 0
              ? GLOW_GOLD
              : GLOW_GOLD_SOFT
            : index % 14 === 0
              ? GLOW_PURPLE
              : GLOW_BLUE
          : NODE_COLOR;
        ctx.fillStyle = color;
        // CONTROL OS — Etapa 10A: halo suave nos nós de destaque — "glow
        // discreto" pedido explicitamente. Reset sempre depois de desenhar,
        // pra nunca vazar sombra pras linhas de conexão desenhadas antes.
        if (isGlowNode) {
          ctx.shadowColor = color;
          ctx.shadowBlur = GLOW_NODE_SHADOW_BLUR;
        }
        ctx.beginPath();
        ctx.arc(node.x, node.y, isGlowNode ? 2.2 : 1.3, 0, Math.PI * 2);
        ctx.fill();
        if (isGlowNode) {
          ctx.shadowBlur = 0;
        }
      });
    };

    const step = (time: number) => {
      if (time - lastFrameTime < TARGET_FRAME_MS) {
        frameId = window.requestAnimationFrame(step);
        return;
      }
      lastFrameTime = time;

      nodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;
      });

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
    // `isLegendary` entra na dependência pra recolorir os nós de destaque
    // assim que a persona muda — o efeito inteiro reexecuta (recria `nodes`
    // via `resize()`), mesmo custo/comportamento que já acontecia a cada
    // resize de janela; a troca de persona é uma ação rara do usuário, nunca
    // um valor que muda em loop.
  }, [prefersReducedMotion, isLegendary]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className ?? 'pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-70'}
    />
  );
}
