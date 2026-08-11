import * as React from 'react';
import { cn } from '@control-os/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error = false, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-11 w-full rounded-md border bg-tint/[0.03] px-4 text-sm text-text-primary placeholder:text-text-tertiary transition-all duration-fast ease-out',
          // CONTROL OS — Etapa 16D: mesmo glow de foco já usado na busca do
          // Topbar (`focus-visible:shadow-glow-purple`) — faltava aqui, o
          // input de formulário "genérico" ficava sem nenhuma resposta de
          // luz ao focar, inconsistente com o resto da biblioteca.
          'border-tint/10 focus-visible:outline-none focus-visible:border-accent-purple/40 focus-visible:bg-tint/[0.05] focus-visible:shadow-glow-purple',
          'disabled:cursor-not-allowed disabled:opacity-40',
          error && 'border-accent-red/60 focus-visible:border-accent-red focus-visible:shadow-none',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
