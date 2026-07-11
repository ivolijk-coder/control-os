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
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  children?: React.ReactNode;
}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, className }))} {...props} />;
}
