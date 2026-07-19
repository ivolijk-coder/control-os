'use client';

import * as React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { hoverLift, scaleIn } from '@/lib/motion';

export interface GlassCardProps extends HTMLMotionProps<'div'> {
  children?: React.ReactNode;
  /** Ativa hover/tap lift (Nova Experience — Fase 1). Padrão: true. */
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
 * GlassCard — superfície de vidro interativa (Nova Experience — Fase 1).
 *
 * Diferente do `Card` de `@control-os/ui` (superfície estática de exibição
 * de dados), o `GlassCard` é feito para contextos hero/CTA que respondem ao
 * usuário: eleva no hover, comprime no tap, e pode carregar um glow ambiente.
 *
 * CONTROL OS — Etapa 10A: ganhou o mesmo realce de topo (linha de luz
 * horizontal, quase imperceptível) que o `Card` de `@control-os/ui` ganhou,
 * pra manter as duas superfícies de vidro do sistema com a mesma linguagem.
 *
 * CONTROL OS — Etapa 16D: `shadow-e3` → `shadow-e3-glass` — mesmo ajuste
 * aplicado no `Card` de `@control-os/ui` (ver comentário lá), mantendo as
 * duas superfícies de vidro do sistema pixel-idênticas em profundidade.
 */
export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, children, interactive = true, glow = 'none', ...props }, ref) => (
    <motion.div
      ref={ref}
      variants={scaleIn}
      className={cn(
        'relative overflow-hidden rounded-xl border border-white/[0.08] bg-card/60 shadow-e3-glass backdrop-blur-md',
        'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent',
        interactive && 'cursor-pointer hover:shadow-e4',
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
