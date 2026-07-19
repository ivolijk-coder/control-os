'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HERO_PERSONA_COLOR, HERO_PERSONA_COLOR_BRIGHT, HERO_PERSONA_COLOR_DIM } from './hero-scene/hero-scene-constants';
import { hexToRgba } from '@/lib/utils';

export interface NovaRingObjectProps {
  className?: string;
  /**
   * Diâmetro do anel externo, em px. Padrão `190` — o tamanho original do
   * Hero Object grande em `/nova`. Todas as outras medidas são
   * proporcionais a este valor, pra reaproveitar o MESMO objeto em
   * qualquer escala (botão flutuante, card do dashboard, popover, hero).
   */
  size?: number;
}

/** Tamanho de referência (px) — todas as proporções abaixo foram medidas em cima deste valor original. */
const BASE_SIZE = 190;

/**
 * Abaixo deste tamanho (px), o objeto entra em "modo ícone": mantém o
 * plasma (gradiente rotativo + glow volumétrico), mas desliga a
 * turbulência SVG, as partículas orbitando e os arcos elétricos — o botão
 * flutuante global (`NovaFloatingLauncher`) fica montado em TODA página,
 * então é o candidato errado pra carregar o efeito mais caro
 * (`feTurbulence` recalculado a cada quadro); o hero grande de `/nova` e o
 * card do Dashboard, que aparecem sozinhos ou em poucas cópias por vez,
 * ganham a versão completa.
 */
const DETAIL_THRESHOLD = 60;

/** Partículas orbitando — array fixo (não aleatório) pra never divergir entre o render do servidor e o do cliente. Fração do raio/tamanho do objeto, nunca px absoluto, pra escalar com `size`. */
const NOVA_PARTICLES = [
  { radiusFraction: 0.62, sizeFraction: 0.05, duration: 9, direction: 1, delay: 0 },
  { radiusFraction: 0.76, sizeFraction: 0.032, duration: 13, direction: -1, delay: 1.4 },
  { radiusFraction: 0.55, sizeFraction: 0.028, duration: 7, direction: 1, delay: 2.8 },
  { radiusFraction: 0.82, sizeFraction: 0.038, duration: 16, direction: -1, delay: 0.6 },
] as const;

/**
 * CONTROL OS — Hero Object da NOVA: núcleo de plasma vivo.
 *
 * Evolução pedida explicitamente pelo usuário: "não quero apenas um efeito
 * de brilho, quero que pareçam entidades de energia viva... um núcleo de
 * fusão futurista, nunca fogo comum." Continua em CSS/SVG puro (sem R3F/
 * WebGL — decisão do HERO SCENE REBOOT, mantida) mas agora com camadas
 * reais de física de plasma simulada:
 *
 * - glow volumétrico em 2 camadas respirando fora de fase ("energia
 *   pulsando do centro pra fora");
 * - anel de plasma: gradiente radial-linear girando via SMIL
 *   (`animateTransform` no `gradientTransform`) + distorção de calor via
 *   filtro SVG (`feTurbulence` + `feDisplacementMap`, com `baseFrequency`
 *   animado — "chamas fluidas em movimento constante", nunca uma borda
 *   estática);
 * - reflexo interno girando devagar (`mix-blend-mode: screen`);
 * - partículas orbitando em raios/velocidades diferentes;
 * - arcos elétricos ocasionais, disparados em intervalos aleatórios
 *   (client-only via `useEffect`, nunca no primeiro render — evita
 *   divergência de hidratação entre servidor e cliente);
 * - o glifo "N" como o próprio núcleo: uma camada borrada por trás (glow do
 *   traço) + uma camada nítida com gradiente animado via
 *   `background-clip: text`.
 *
 * Cores continuam vindo só de `hero-scene-constants.ts` (`HERO_PERSONA_COLOR*`)
 * — nenhum tom novo introduzido, é a mesma identidade azul/ciano da NOVA em
 * todo o produto, só com mais camadas de movimento em cima dela.
 */
export function NovaRingObject({ className, size = BASE_SIZE }: NovaRingObjectProps) {
  const color = HERO_PERSONA_COLOR.nova;
  const colorBright = HERO_PERSONA_COLOR_BRIGHT.nova;
  const colorDim = HERO_PERSONA_COLOR_DIM.nova;
  const scale = size / BASE_SIZE;
  const detailed = size >= DETAIL_THRESHOLD;

  const rawId = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradientId = `nova-plasma-gradient-${rawId}`;
  const filterId = `nova-plasma-filter-${rawId}`;

  // Arco elétrico ocasional — intervalo aleatório, só depois de montado no
  // cliente (o primeiro render, servidor e cliente, nunca mostra nenhum
  // arco — sem isso haveria divergência de hidratação por causa do
  // `Math.random`).
  const [arc, setArc] = React.useState<{ id: number; angleDeg: number } | null>(null);
  React.useEffect(() => {
    if (!detailed) return;
    let cancelled = false;
    let nextId = 0;

    function scheduleNext() {
      const delay = 2200 + Math.random() * 3400;
      window.setTimeout(() => {
        if (cancelled) return;
        nextId += 1;
        setArc({ id: nextId, angleDeg: Math.random() * 360 });
        window.setTimeout(() => {
          if (!cancelled) setArc(null);
        }, 260);
        scheduleNext();
      }, delay);
    }

    scheduleNext();
    return () => {
      cancelled = true;
    };
  }, [detailed]);

  return (
    <div aria-hidden className={`relative flex h-full w-full items-center justify-center ${className ?? ''}`}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Glow volumétrico — 2 camadas respirando fora de fase. */}
        <motion.div
          className="absolute rounded-full"
          style={{
            inset: -18 * scale,
            background: `radial-gradient(circle, ${hexToRgba(color, 0.32)} 0%, transparent 70%)`,
            filter: `blur(${14 * scale}px)`,
          }}
          animate={{ opacity: [0.45, 0.85, 0.45], scale: [0.94, 1.06, 0.94] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{
            inset: -6 * scale,
            background: `radial-gradient(circle, ${hexToRgba(colorBright, 0.28)} 0%, transparent 65%)`,
            filter: `blur(${8 * scale}px)`,
          }}
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [1.02, 0.96, 1.02] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
        />

        {/* Casca escura — o "corpo" físico por trás do plasma. */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: `${9 * scale}px solid #0a0e14`,
            boxShadow: `inset 0 0 ${24 * scale}px ${hexToRgba(colorDim, 0.5)}`,
          }}
        />

        {/* Anel de plasma — gradiente girando via SMIL + distorção de calor via filtro SVG (só instâncias "detailed"). */}
        <svg className="absolute inset-0" width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="10" y1="50" x2="90" y2="50">
              <stop offset="0%" stopColor={colorDim} />
              <stop offset="30%" stopColor={color} />
              <stop offset="55%" stopColor={colorBright} />
              <stop offset="75%" stopColor={color} />
              <stop offset="100%" stopColor={colorDim} />
              <animateTransform
                attributeName="gradientTransform"
                type="rotate"
                from="0 50 50"
                to="360 50 50"
                dur="6s"
                repeatCount="indefinite"
              />
            </linearGradient>
            {detailed && (
              <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
                <feTurbulence type="fractalNoise" baseFrequency="0.025 0.07" numOctaves={2} seed={4} result="noise">
                  <animate attributeName="baseFrequency" values="0.02 0.06;0.04 0.09;0.02 0.06" dur="7s" repeatCount="indefinite" />
                </feTurbulence>
                <feDisplacementMap in="SourceGraphic" in2="noise" scale={4.5} xChannelSelector="R" yChannelSelector="G" />
              </filter>
            )}
          </defs>
          <circle
            cx={50}
            cy={50}
            r={42}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={4.5}
            strokeLinecap="round"
            filter={detailed ? `url(#${filterId})` : undefined}
          />
        </svg>

        {/* Reflexo interno — highlight girando devagar por dentro do anel. */}
        <motion.div
          className="absolute rounded-full"
          style={{
            inset: 35 * scale,
            background: `conic-gradient(from 0deg, transparent 0%, ${hexToRgba(colorBright, 0.55)} 6%, transparent 16%, transparent 100%)`,
            mixBlendMode: 'screen',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute rounded-full" style={{ inset: 35 * scale, border: `${1.5 * scale}px solid ${hexToRgba(color, 0.4)}` }} />

        {/* Partículas orbitando (só "detailed"). */}
        {detailed &&
          NOVA_PARTICLES.map((particle) => {
            const dotSize = Math.max(2, particle.sizeFraction * size);
            return (
              <motion.div
                key={particle.delay}
                className="absolute inset-0"
                animate={{ rotate: particle.direction * 360 }}
                transition={{ duration: particle.duration, repeat: Infinity, ease: 'linear', delay: particle.delay }}
              >
                <motion.span
                  className="absolute rounded-full"
                  style={{
                    top: '50%',
                    left: '50%',
                    width: dotSize,
                    height: dotSize,
                    marginLeft: -dotSize / 2,
                    marginTop: -dotSize / 2,
                    background: colorBright,
                    boxShadow: `0 0 ${6 * scale}px ${hexToRgba(color, 0.9)}`,
                    transform: `translateX(${particle.radiusFraction * (size / 2)}px)`,
                  }}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: particle.duration / 3, repeat: Infinity, ease: 'easeInOut' }}
                />
              </motion.div>
            );
          })}

        {/* Arco elétrico ocasional — flash curto num ângulo aleatório (só "detailed"). */}
        {detailed && (
          <AnimatePresence>
            {arc && (
              <motion.svg
                key={arc.id}
                className="absolute inset-0"
                width={size}
                height={size}
                viewBox="0 0 100 100"
                style={{ overflow: 'visible', transform: `rotate(${arc.angleDeg}deg)` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.26, ease: 'easeOut' }}
              >
                <path
                  d="M 50 8 L 46 18 L 53 22 L 47 34"
                  fill="none"
                  stroke={colorBright}
                  strokeWidth={1.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: `drop-shadow(0 0 4px ${color})` }}
                />
              </motion.svg>
            )}
          </AnimatePresence>
        )}

        {/* Glifo "N" — núcleo: glow borrado atrás + preenchimento em gradiente animado (plasma). */}
        <div className="absolute inset-0 flex items-center justify-center font-semibold" style={{ fontSize: 34 * scale }}>
          <span className="absolute" style={{ color, filter: `blur(${5 * scale}px)`, opacity: 0.85 }}>
            N
          </span>
          <motion.span
            style={{
              backgroundImage: `linear-gradient(115deg, ${colorDim} 0%, ${color} 30%, ${colorBright} 50%, ${color} 70%, ${colorDim} 100%)`,
              backgroundSize: '260% 260%',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              filter: `drop-shadow(0 0 ${10 * scale}px ${hexToRgba(color, 0.85)})`,
            }}
            animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          >
            N
          </motion.span>
        </div>
      </div>
    </div>
  );
}
