'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { hexToRgba } from '@/lib/utils';

export interface LegendaryCrystalObjectProps {
  className?: string;
  /**
   * Lado do cristal (antes da rotação de 45°), em px. Padrão `66` — o
   * tamanho original do widget da LEGENDARY em `AgentWidgetCard`. Mesmo
   * padrão de escala proporcional de `NovaRingObject` — o mesmo objeto
   * reaproveitado em qualquer contexto, nunca uma segunda implementação
   * divergente.
   */
  size?: number;
}

const BASE_SIZE = 66;

/**
 * Abaixo deste tamanho (px) o cristal entra em "modo ícone": mantém o
 * corpo em ouro líquido (gradiente girando + glow), mas desliga
 * turbulência SVG, partículas subindo, fumaça e faíscas — mesmo raciocínio
 * de custo/benefício de `NOVA_RING_OBJECT.DETAIL_THRESHOLD`.
 */
const DETAIL_THRESHOLD = 40;

const GOLD = '#d9a455';
const GOLD_BRIGHT = '#f6e4c2';
const GOLD_DIM = '#2e2210';

/** Partículas subindo — array fixo (não aleatório), em fração do tamanho do objeto. */
const EMBER_PARTICLES = [
  { xFraction: -0.22, duration: 3.4, delay: 0 },
  { xFraction: 0.1, duration: 4.1, delay: 1.1 },
  { xFraction: -0.05, duration: 3.7, delay: 2.2 },
  { xFraction: 0.24, duration: 4.6, delay: 0.6 },
] as const;

/**
 * CONTROL OS — Hero Object da LEGENDARY: relíquia de ouro líquido.
 *
 * Evolução pedida explicitamente pelo usuário: "não vermelho, não laranja
 * exagerado — ouro líquido, metal incandescente, chama dourada, brasas
 * vivas, energia mística... uma relíquia lendária despertando." Continua
 * em CSS/SVG puro (o cristal 3D em R3F de `/legendary` está fora do
 * escopo desta mudança — decisão explícita do usuário, ver
 * `nova-hero-stage.tsx`).
 *
 * Camadas:
 * - glow pulsante (brasas respirando por trás do corpo);
 * - corpo do cristal: gradiente girando via SMIL + distorção sutil de
 *   calor via filtro SVG (`feTurbulence`/`feDisplacementMap`, escala bem
 *   menor que a da NOVA — "extremamente discreta", nunca chapiscado);
 * - reflexo interno cruzando na diagonal ("metal incandescente");
 * - fumaça extremamente discreta subindo (opacidade baixíssima);
 * - partículas douradas subindo, cada uma com seu próprio ritmo;
 * - faísca ocasional, disparada em intervalo aleatório (client-only,
 *   nunca no primeiro render — evita divergência de hidratação);
 * - o glifo "L" com aspecto forjado: preenchimento em gradiente animado +
 *   bevel via duas sombras (clara por cima, escura por baixo).
 *
 * Cores continuam só as três já estabelecidas pra LEGENDARY (dourado/âmbar
 * — nunca vermelho/laranja), sem introduzir um tom novo.
 */
export function LegendaryCrystalObject({ className, size = BASE_SIZE }: LegendaryCrystalObjectProps) {
  const scale = size / BASE_SIZE;
  const detailed = size >= DETAIL_THRESHOLD;

  const rawId = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradientId = `legendary-gold-gradient-${rawId}`;
  const filterId = `legendary-gold-filter-${rawId}`;

  // Faísca ocasional — mesmo raciocínio do arco elétrico da NOVA: só
  // client-side, nunca no primeiro render.
  const [spark, setSpark] = React.useState<{ id: number; xPercent: number; yPercent: number } | null>(null);
  React.useEffect(() => {
    if (!detailed) return;
    let cancelled = false;
    let nextId = 0;

    function scheduleNext() {
      const delay = 2600 + Math.random() * 3800;
      window.setTimeout(() => {
        if (cancelled) return;
        nextId += 1;
        setSpark({ id: nextId, xPercent: 30 + Math.random() * 40, yPercent: 25 + Math.random() * 50 });
        window.setTimeout(() => {
          if (!cancelled) setSpark(null);
        }, 420);
        scheduleNext();
      }, delay);
    }

    scheduleNext();
    return () => {
      cancelled = true;
    };
  }, [detailed]);

  return (
    <div aria-hidden className={`relative ${className ?? ''}`} style={{ width: size, height: size }}>
      {/* Glow pulsante — brasas respirando por trás do corpo. */}
      <motion.div
        className="absolute rounded-full"
        style={{
          inset: -14 * scale,
          background: `radial-gradient(circle, ${hexToRgba(GOLD, 0.35)} 0%, transparent 70%)`,
          filter: `blur(${10 * scale}px)`,
        }}
        animate={{ opacity: [0.5, 0.9, 0.5], scale: [0.95, 1.07, 0.95] }}
        transition={{ duration: 4.6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Corpo do cristal — ouro líquido girando + distorção sutil (só "detailed"). */}
      <svg className="absolute inset-0" width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="15" y1="50" x2="85" y2="50">
            <stop offset="0%" stopColor={GOLD_DIM} />
            <stop offset="28%" stopColor={GOLD} />
            <stop offset="52%" stopColor={GOLD_BRIGHT} />
            <stop offset="76%" stopColor={GOLD} />
            <stop offset="100%" stopColor={GOLD_DIM} />
            <animateTransform
              attributeName="gradientTransform"
              type="rotate"
              from="0 50 50"
              to="360 50 50"
              dur="8s"
              repeatCount="indefinite"
            />
          </linearGradient>
          {detailed && (
            <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves={2} seed={9} result="noise">
                <animate attributeName="baseFrequency" values="0.01 0.03;0.02 0.045;0.01 0.03" dur="9s" repeatCount="indefinite" />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" in2="noise" scale={3} xChannelSelector="R" yChannelSelector="G" />
            </filter>
          )}
        </defs>
        <rect
          x={18}
          y={18}
          width={64}
          height={64}
          rx={6}
          transform="rotate(45 50 50)"
          fill={`url(#${gradientId})`}
          filter={detailed ? `url(#${filterId})` : undefined}
          stroke="rgba(0,0,0,0.35)"
          strokeWidth={0.6}
        />
        <rect x={30.5} y={30.5} width={39} height={39} rx={3} transform="rotate(45 50 50)" fill="#0a0704" opacity={0.9} />
      </svg>

      {/* Reflexo interno — faixa clara cruzando na diagonal ("metal incandescente"). */}
      <motion.div
        className="absolute overflow-hidden"
        style={{
          inset: 9 * scale,
          backgroundImage: `linear-gradient(120deg, transparent 30%, ${hexToRgba(GOLD_BRIGHT, 0.5)} 48%, transparent 66%)`,
          backgroundSize: '260% 100%',
          mixBlendMode: 'screen',
        }}
        animate={{ backgroundPosition: ['-60% 0%', '160% 0%'] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.4 }}
      />

      {/* Fumaça extremamente discreta subindo (só "detailed"). */}
      {detailed && (
        <motion.div
          className="absolute rounded-full"
          style={{
            left: '50%',
            bottom: '55%',
            width: 18 * scale,
            height: 18 * scale,
            marginLeft: -9 * scale,
            background: `radial-gradient(circle, ${hexToRgba('#c9c2b0', 0.14)} 0%, transparent 75%)`,
            filter: `blur(${4 * scale}px)`,
          }}
          animate={{ y: [0, -26 * scale], opacity: [0, 0.5, 0], scale: [0.8, 1.3] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: 'easeOut' }}
        />
      )}

      {/* Partículas douradas subindo (só "detailed"). */}
      {detailed &&
        EMBER_PARTICLES.map((particle) => (
          <motion.span
            key={particle.delay}
            className="absolute rounded-full"
            style={{
              left: `${50 + particle.xFraction * 100}%`,
              bottom: '30%',
              width: 2.4 * scale,
              height: 2.4 * scale,
              background: GOLD_BRIGHT,
              boxShadow: `0 0 ${4 * scale}px ${hexToRgba(GOLD, 0.9)}`,
            }}
            animate={{ y: [0, -size * 0.85], opacity: [0, 1, 1, 0] }}
            transition={{ duration: particle.duration, repeat: Infinity, ease: 'easeOut', delay: particle.delay }}
          />
        ))}

      {/* Faísca ocasional (só "detailed"). */}
      {detailed && (
        <AnimatePresence>
          {spark && (
            <motion.span
              key={spark.id}
              className="absolute rounded-full"
              style={{
                left: `${spark.xPercent}%`,
                top: `${spark.yPercent}%`,
                width: 2.4,
                height: 2.4,
                background: '#fff6df',
                boxShadow: `0 0 5px ${hexToRgba(GOLD_BRIGHT, 0.95)}`,
              }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: [0, 1, 0], scale: [0.4, 1.4, 0.6] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.42, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>
      )}

      {/* Glifo "L" — forjado: gradiente dourado animado + bevel via sombra dupla. */}
      <div className="absolute inset-0 flex items-center justify-center font-semibold" style={{ fontSize: 14 * scale }}>
        <motion.span
          style={{
            backgroundImage: `linear-gradient(160deg, ${GOLD_DIM} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 50%, ${GOLD} 65%, ${GOLD_DIM} 100%)`,
            backgroundSize: '260% 260%',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            filter: `drop-shadow(0 ${1 * scale}px 0 rgba(0,0,0,0.55)) drop-shadow(0 -${0.5 * scale}px 0 ${hexToRgba(GOLD_BRIGHT, 0.6)}) drop-shadow(0 0 ${6 * scale}px ${hexToRgba(GOLD, 0.85)})`,
          }}
          animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          L
        </motion.span>
      </div>
    </div>
  );
}
