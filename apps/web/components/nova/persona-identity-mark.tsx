'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export type PersonaIdentity = 'nova' | 'legendary';

export interface PersonaIdentityMarkProps {
  persona?: PersonaIdentity;
  size?: number;
  className?: string;
}

/**
 * Símbolo oficial reduzido do CONTROL OS.
 *
 * A geometria é a da marca aprovada: aro externo fino, arco interno aberto
 * e ponto no alto à direita. NOVA usa azul/ciano/roxo; LEGENDARY preserva o
 * desenho e troca apenas a matéria para ouro incandescente.
 */
export function PersonaIdentityMark({ persona = 'nova', size = 28, className }: PersonaIdentityMarkProps) {
  const rawId = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const reduceMotion = useReducedMotion();
  const isLegendary = persona === 'legendary';
  const colors = isLegendary
    ? { dim: '#9a3f08', base: '#ff9a22', bright: '#ffe39a', glow: 'rgba(255, 124, 24, 0.62)' }
    : { dim: '#313dff', base: '#16b8ff', bright: '#d8f5ff', glow: 'rgba(38, 168, 255, 0.6)' };
  const gradientId = `persona-mark-${persona}-${rawId}`;
  const outerGradientId = `persona-mark-outer-${persona}-${rawId}`;

  return (
    <span aria-hidden="true" className={`relative block shrink-0 ${className ?? ''}`} style={{ width: size, height: size }}>
      <motion.span
        className="absolute -inset-1 rounded-full"
        style={{
          background: `conic-gradient(from 12deg, transparent 0deg, transparent 110deg, ${colors.bright} 155deg, ${colors.base} 190deg, transparent 235deg, transparent 360deg)`,
          filter: `blur(${Math.max(1, size * 0.025)}px)`,
          opacity: 0.42,
        }}
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: isLegendary ? 8.8 : 7.2, repeat: Infinity, ease: 'linear' }}
      />
      <span className="absolute inset-0 rounded-full bg-[#050608] shadow-[inset_0_0_18px_rgba(0,0,0,0.9)]" />
      <svg className="absolute inset-[5%] overflow-visible" viewBox="0 0 100 100" fill="none">
        <defs>
          <linearGradient id={gradientId} x1="40" y1="22" x2="77" y2="64" gradientUnits="userSpaceOnUse">
            <stop stopColor={isLegendary ? '#fff3c9' : '#f5f8ff'} />
            <stop offset="0.26" stopColor={colors.bright} />
            <stop offset="0.7" stopColor={colors.base} />
            <stop offset="1" stopColor={colors.dim} />
          </linearGradient>
          <linearGradient id={outerGradientId} x1="12" y1="82" x2="88" y2="18" gradientUnits="userSpaceOnUse">
            <stop stopColor={colors.dim} />
            <stop offset="0.46" stopColor={colors.base} />
            <stop offset="0.76" stopColor={colors.bright} />
            <stop offset="1" stopColor={colors.base} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="46" stroke={`url(#${outerGradientId})`} strokeWidth="1.65" opacity="0.96" />
        {!reduceMotion && (
          <motion.g style={{ transformOrigin: '50px 50px' }} animate={{ rotate: 360 }} transition={{ duration: isLegendary ? 8.8 : 7.2, repeat: Infinity, ease: 'linear' }}>
            <circle cx="50" cy="50" r="46" stroke={colors.bright} strokeWidth="1.8" strokeLinecap="round" strokeDasharray="8 282" opacity="0.85" />
          </motion.g>
        )}
        <path d="M 39.5 22.5 A 30.5 30.5 0 1 0 78 61" stroke={`url(#${gradientId})`} strokeWidth="11.8" strokeLinecap="butt" />
        <circle cx="65.5" cy="25.5" r="7.8" fill={colors.base} style={{ filter: `drop-shadow(0 0 6px ${colors.glow})` }} />
      </svg>
    </span>
  );
}
