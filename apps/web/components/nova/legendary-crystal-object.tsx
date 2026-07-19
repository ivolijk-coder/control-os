'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

export interface LegendaryCrystalObjectProps {
  className?: string;
  /**
   * Lado do cristal (antes da rotação de 45°), em px. Padrão `66` — o
   * tamanho original do widget da LEGENDARY em `AgentWidgetCard`. Mesmo
   * padrão de escala proporcional de `NovaRingObject` (`size`/`BASE_SIZE`)
   * — o mesmo objeto reaproveitado em qualquer contexto (card do
   * dashboard, swatch do popover do botão flutuante), nunca uma segunda
   * implementação divergente do cristal.
   */
  size?: number;
}

const BASE_SIZE = 66;

/**
 * CONTROL OS — cristal da LEGENDARY em CSS puro (gradiente + shimmer via
 * Framer Motion), extraído de `agent-widget-card.tsx` pra virar um objeto
 * reutilizável — mesmo motivo que criou `NovaRingObject`: o botão
 * flutuante global (`NovaFloatingLauncher`) precisa mostrar a MESMA
 * identidade visual da LEGENDARY no popover, não uma terceira versão
 * desenhada à parte.
 */
export function LegendaryCrystalObject({ className, size = BASE_SIZE }: LegendaryCrystalObjectProps) {
  const scale = size / BASE_SIZE;
  const holeInset = 9 * scale;

  return (
    <div className={`relative ${className ?? ''}`} style={{ width: size, height: size }}>
      <motion.div
        style={{
          width: size,
          height: size,
          rotate: 45,
          background: 'linear-gradient(135deg, #4a3616 0%, #C9962F 35%, #F4D889 50%, #C9962F 65%, #2a1d0a 100%)',
          backgroundSize: '220% 220%',
          boxShadow: `0 0 ${20 * scale}px rgba(201,150,47,0.4), inset 0 0 ${8 * scale}px rgba(0,0,0,0.4)`,
        }}
        animate={{ backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
        transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
      />
      <div
        className="absolute"
        style={{
          inset: holeInset,
          background: '#0A0704',
          transform: 'rotate(45deg)',
          boxShadow: `inset 0 0 ${8 * scale}px rgba(201,150,47,0.3)`,
        }}
      />
      <div
        className="absolute inset-0 flex items-center justify-center font-semibold"
        style={{ fontSize: 14 * scale, color: '#F4D889', textShadow: `0 0 ${6 * scale}px rgba(201,150,47,0.8)` }}
      >
        L
      </div>
    </div>
  );
}
