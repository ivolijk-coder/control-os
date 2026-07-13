import * as React from 'react';
import { cn } from '@/lib/utils';

const ACCENT_STROKE: Record<'purple' | 'blue' | 'green' | 'red', string> = {
  purple: 'stroke-accent-purple',
  blue: 'stroke-accent-blue',
  green: 'stroke-accent-green',
  red: 'stroke-accent-red',
};

export interface ProgressRingProps {
  /** 0–100. */
  value: number;
  size?: number;
  strokeWidth?: number;
  accent?: 'purple' | 'blue' | 'green' | 'red';
  /** Conteúdo centralizado dentro do anel (ex.: "34%"). */
  children?: React.ReactNode;
  className?: string;
}

/**
 * ProgressRing — anel de progresso circular em SVG puro (CONTROL OS —
 * Etapa 10B). Sem lib de gráfico nova — só `stroke-dasharray`/`stroke-
 * dashoffset`, o mesmo truque usado em qualquer indicador circular. Usado
 * onde uma barra linear (`Progress`, já existente) não comunica bem "quanto
 * falta" de forma compacta (Metas: chance de concluir; Hábitos: taxa de
 * sucesso).
 */
export function ProgressRing({ value, size = 64, strokeWidth = 6, accent = 'purple', children, className }: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="fill-none stroke-white/[0.08]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('fill-none transition-[stroke-dashoffset] duration-slow ease-out', ACCENT_STROKE[accent])}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}
