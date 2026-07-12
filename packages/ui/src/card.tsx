import * as React from 'react';
import { cn } from '@control-os/utils';

/**
 * Todas as interfaces abaixo usam `ComponentPropsWithoutRef<'tag'>` (o tipo
 * que o próprio React usa para as props do elemento JSX correspondente),
 * em vez de `HTMLAttributes<...>`. Isso preserva automaticamente toda prop
 * nativa do elemento renderizado (className, style, id, onClick, data-*,
 * aria-*, etc.) sem precisar redeclará-las manualmente.
 */
export interface CardProps extends React.ComponentPropsWithoutRef<'div'> {
  children?: React.ReactNode;
}

export interface CardHeaderProps extends React.ComponentPropsWithoutRef<'div'> {
  children?: React.ReactNode;
}

export interface CardTitleProps extends React.ComponentPropsWithoutRef<'h3'> {
  children?: React.ReactNode;
}

export interface CardDescriptionProps extends React.ComponentPropsWithoutRef<'p'> {
  children?: React.ReactNode;
}

export interface CardContentProps extends React.ComponentPropsWithoutRef<'div'> {
  children?: React.ReactNode;
}

export interface CardFooterProps extends React.ComponentPropsWithoutRef<'div'> {
  children?: React.ReactNode;
}

/**
 * Cartão base do CONTROL OS — superfície de vidro elevada sobre o fundo
 * #050505. `bg-card/80` + `backdrop-blur-sm` deixam o Background vivo (Fase
 * 2: Nova Experience) sutilmente visível através da superfície, mantendo
 * legibilidade total do conteúdo.
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border border-white/[0.08] bg-card/80 shadow-e2 backdrop-blur-sm transition-colors duration-base ease-out',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1 p-5', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-sm font-medium text-text-primary', className)} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-xs text-text-secondary', className)} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-5 pt-0', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';
