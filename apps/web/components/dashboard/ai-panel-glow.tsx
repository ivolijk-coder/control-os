'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { HERO_PERSONA_COLOR, HERO_PERSONA_COLOR_BRIGHT, HERO_PERSONA_COLOR_DIM } from '@/components/nova/hero-scene/hero-scene-constants';
import { hexToRgba } from '@/lib/utils';
import type { NovaPersona } from '@/services/nova';

export interface AiPanelGlowProps {
  /** Persona ativa — decide qual das duas camadas de cor fica visível. */
  persona: NovaPersona;
  className?: string;
  children: React.ReactNode;
}

/**
 * CONTROL OS — glow premium do painel principal da IA (`AgentWidgetCard`).
 *
 * Pedido explícito do usuário: "não altere layout, tamanho ou componentes
 * internos, quero apenas transformar esse card no ponto focal da
 * interface." Por isso este componente nunca toca o JSX do card em si — só
 * o ENVOLVE (`children`), acrescentando camadas de glow posicionadas atrás
 * dele. O card recebe apenas `relative z-10` no wrapper que o embrulha
 * (necessário pra ele ficar acima das camadas de glow na pilha de
 * empilhamento) — nenhuma classe do card original é tocada.
 *
 * "Acabamento cinematográfico... múltiplas camadas de glow... nunca um
 * simples box-shadow": três camadas por persona, cada uma com seu próprio
 * ritmo de respiração (fase/duração diferentes, "pequenas variações de
 * intensidade, como energia fluindo"):
 * - bloom externo — grande, bem desfocado, ilumina o fundo ao redor do card;
 * - glow médio — mais próximo da borda, mais concentrado;
 * - contorno de energia — um traço fino, exatamente na borda do card,
 *   com um gradiente girando (mesma técnica SMIL/`animateTransform` já
 *   usada em `NovaRingObject`/`LegendaryCrystalObject`, nunca um
 *   `@keyframes` CSS novo). Medido via `ResizeObserver` (não um tamanho
 *   fixo) pra acompanhar exatamente a largura responsiva do card e nunca
 *   distorcer o raio dos cantos.
 *
 * As duas personas ficam sempre montadas ao mesmo tempo — a troca entre
 * elas é só a opacidade do grupo animando entre 0 e 1 (`AnimatePresence`
 * NÃO é usado aqui de propósito: ele desmonta uma camada antes de montar a
 * outra, o que criaria um corte, não um crossfade). Com as duas sempre
 * presentes e a opacidade animando em paralelo, o azul realmente desaparece
 * enquanto o dourado surge por cima — pedido explícito do usuário.
 */
export function AiPanelGlow({ persona, className, children }: AiPanelGlowProps) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrapperRef} className={`relative ${className ?? ''}`}>
      <PersonaGlowGroup
        active={persona === 'nova'}
        size={size}
        color={HERO_PERSONA_COLOR.nova}
        colorBright={HERO_PERSONA_COLOR_BRIGHT.nova}
        colorDim={HERO_PERSONA_COLOR_DIM.nova}
      />
      <PersonaGlowGroup
        active={persona === 'legendary'}
        size={size}
        color={HERO_PERSONA_COLOR.legendary}
        colorBright={HERO_PERSONA_COLOR_BRIGHT.legendary}
        colorDim={HERO_PERSONA_COLOR_DIM.legendary}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function PersonaGlowGroup({
  active,
  size,
  color,
  colorBright,
  colorDim,
}: {
  active: boolean;
  size: { width: number; height: number };
  color: string;
  colorBright: string;
  colorDim: string;
}) {
  const rawId = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradientId = `ai-panel-glow-gradient-${rawId}`;
  const strokeInset = 2;
  const svgWidth = size.width + strokeInset * 2;
  const svgHeight = size.height + strokeInset * 2;

  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      animate={{ opacity: active ? 1 : 0 }}
      // 500ms — dentro da janela de 400–600ms pedida, "nenhuma troca brusca".
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      {/* Bloom externo — desfocado, ilumina levemente o fundo ao redor do card. */}
      <motion.div
        className="absolute rounded-[32px]"
        style={{
          inset: -34,
          background: `radial-gradient(circle, ${hexToRgba(color, 0.28)} 0%, transparent 72%)`,
          filter: 'blur(30px)',
        }}
        animate={{ opacity: [0.35, 0.6, 0.35], scale: [0.97, 1.03, 0.97] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Glow médio — mais concentrado, logo fora da borda. */}
      <motion.div
        className="absolute rounded-2xl"
        style={{
          inset: -12,
          background: `radial-gradient(circle, ${hexToRgba(colorBright, 0.22)} 0%, transparent 68%)`,
          filter: 'blur(16px)',
        }}
        animate={{ opacity: [0.4, 0.75, 0.4] }}
        transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
      />
      {/* Contorno de energia — traço fino na borda exata do card, com gradiente girando devagar. Só desenha depois que o ResizeObserver mede o card (evita um SVG 0×0 no primeiro quadro). */}
      {svgWidth > 0 && svgHeight > 0 && (
        <svg
          className="absolute"
          style={{ left: -strokeInset, top: -strokeInset, overflow: 'visible' }}
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        >
          <defs>
            <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={0} y1={svgHeight / 2} x2={svgWidth} y2={svgHeight / 2}>
              <stop offset="0%" stopColor={colorDim} />
              <stop offset="30%" stopColor={color} />
              <stop offset="55%" stopColor={colorBright} />
              <stop offset="75%" stopColor={color} />
              <stop offset="100%" stopColor={colorDim} />
              <animateTransform
                attributeName="gradientTransform"
                type="rotate"
                from={`0 ${svgWidth / 2} ${svgHeight / 2}`}
                to={`360 ${svgWidth / 2} ${svgHeight / 2}`}
                dur="10s"
                repeatCount="indefinite"
              />
            </linearGradient>
          </defs>
          <rect
            x={strokeInset / 2}
            y={strokeInset / 2}
            width={svgWidth - strokeInset}
            height={svgHeight - strokeInset}
            rx={14}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={1.4}
            style={{ filter: `drop-shadow(0 0 6px ${hexToRgba(color, 0.55)})` }}
          />
        </svg>
      )}
    </motion.div>
  );
}
