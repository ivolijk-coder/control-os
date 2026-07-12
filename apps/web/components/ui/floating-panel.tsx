'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

export interface FloatingPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Título acessível (lido por leitor de tela; visualmente oculto por padrão). */
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * FloatingPanel — painel flutuante de vidro reutilizável (Nova Experience —
 * Fase 3). Base do Command Center e de futuros overlays. Usa Radix Dialog
 * para acessibilidade (focus trap, ESC, clique fora) e as animações
 * `data-[state]` do `tailwindcss-animate` (já presente no stack) em vez de
 * duplicar lógica de transição com Framer Motion.
 */
export function FloatingPanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: FloatingPanelProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-24 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl border border-white/[0.08] bg-card/80 shadow-e5 backdrop-blur-xl focus:outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2',
            className
          )}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {description && <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description>}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
