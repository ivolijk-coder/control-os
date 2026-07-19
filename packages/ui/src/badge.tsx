import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@control-os/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
  {
    variants: {
      variant: {
        neutral: 'border-white/10 bg-white/[0.06] text-text-secondary',
        green: 'border-accent-green/20 bg-accent-green/10 text-accent-green',
        blue: 'border-accent-blue/20 bg-accent-blue/10 text-accent-blue',
        purple: 'border-accent-purple/20 bg-accent-purple/10 text-accent-purple',
        red: 'border-accent-red/20 bg-accent-red/10 text-accent-red',
        // CONTROL OS — Etapa 16D (Design System premium): variante dourada
        // — faltava na biblioteca de badges desde a Etapa 15 (LEGENDARY);
        // mesmo padrão de opacidade das outras variantes, cor de
        // `accent.gold` (Etapa 15/16A).
        gold: 'border-accent-gold/20 bg-accent-gold/10 text-accent-gold',
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
);

/**
 * `ComponentPropsWithoutRef<'div'>` (não `HTMLAttributes<HTMLDivElement>`) —
 * é o tipo que o próprio React usa para as props de um elemento JSX `<div>`
 * (via `JSX.IntrinsicElements['div']`), então toda prop nativa do elemento
 * renderizado (className, style, id, onClick, data-*, aria-*, etc.) é
 * preservada automaticamente, sem precisar redeclará-las aqui.
 */
export interface BadgeProps
  extends React.ComponentPropsWithoutRef<'div'>,
    VariantProps<typeof badgeVariants> {
  children?: React.ReactNode;
}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, className }))} {...props} />;
}
