'use client';

import * as React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { hoverLift, scaleIn } from '@/lib/motion';

export interface GlassCardProps extends HTMLMotionProps<'div'> {
  children?: React.ReactNode;
  /** Ativa hover/tap lift (Fase 2: Nova Experience). Padrão: true. */
  interactive?: boolean;
  /** Cor do glow ambiente atrás do card (blob desfocado no canto superior). */
  glow?: 'purple' | 'blue' | 'green' | 'red' | 'none';
}

const GLOW_CLASSES: Record<NonNullable<GlassCardProps['glow']>, string> = {
  purple: 'from-accent-purple/20',
  blue: 'from-accent-blue/20',
  green: 'from-accent-green/20',
  red: 'from-accent-red/20',
  none: '',
};

/**
 * GlassCard — superfície de vidro interativa (Fase 2: Nova Experience).
 *
 * Diferente do `Card` de `@control-os/ui` (superfície estática de exibição
 * de dados), o `GlassCard` é feito para contextos hero/CTA que respondem ao
 * usuário: eleva no hover, comprime no tap, e pode carregar um glow ambiente.
 */
export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, children, interactive = true, glow = 'none', ...props }, ref) => (
    <motion.div
      ref={ref}
      variants={scaleIn}
      className={cn(
        'relative overflow-hidden rounded-xl border border-white/[0.08] bg-card/60 shadow-e3 backdrop-blur-md',
        interactive && 'cursor-pointer',
        className
      )}
      {...(interactive ? hoverLift : {})}
      {...props}
    >
      {glow !== 'none' && (
        <div
          className={cn(
            'pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br to-transparent blur-3xl',
            GLOW_CLASSES[glow]
          )}
          aria-hidden
        />
      )}
      <div className="relative">{children}</div>
    </motion.div>
  )
);
GlassCard.displayName = 'GlassCard';
