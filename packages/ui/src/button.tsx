'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@control-os/utils';

/**
 * Botão base do CONTROL OS. Segue a escala de movimento da Etapa 1
 * (dur-fast / ease-out) e nunca usa cantos totalmente quadrados.
 *
 * CONTROL OS — Etapa 10A: Premium Visual Identity — cada variante ganhou um
 * leve gradiente (em vez de cor chapada) e uma sombra/glow discreta no
 * hover, além do `active:scale` de tato que já existia. Nunca um segundo
 * gradiente/glow no MESMO estado (hover OU idle, nunca os dois se somando) —
 * "nada de exagero".
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-fast ease-out disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-b from-white to-white/90 text-black shadow-e1 hover:shadow-glow-purple active:scale-[0.98]',
        secondary:
          'bg-white/[0.06] text-text-primary border border-white/10 hover:border-white/20 hover:bg-white/[0.1] active:scale-[0.98]',
        ghost: 'text-text-secondary hover:text-text-primary hover:bg-white/[0.06]',
        danger: 'bg-accent-red text-white hover:bg-accent-red/90 active:scale-[0.98]',
        link: 'text-text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

/**
 * `ComponentPropsWithoutRef<'button'>` — mesmo padrão do Badge: preserva
 * toda prop nativa de `<button>` (className, type, disabled, onClick, etc.)
 * automaticamente via o tipo que o próprio React usa para JSX.
 */
export interface ButtonProps
  extends React.ComponentPropsWithoutRef<'button'>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </Comp>
    );
  }
);
Button.displayName = 'Button';
