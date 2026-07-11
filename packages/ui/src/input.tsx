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
          'flex h-11 w-full rounded-md border bg-white/[0.03] px-4 text-sm text-text-primary placeholder:text-text-tertiary transition-colors duration-fast ease-out',
          'border-white/10 focus-visible:outline-none focus-visible:border-white/25 focus-visible:bg-white/[0.05]',
          'disabled:cursor-not-allowed disabled:opacity-40',
          error && 'border-accent-red/60 focus-visible:border-accent-red',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
