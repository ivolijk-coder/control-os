'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { hoverSubtle } from '@/lib/motion';

export interface QuickActionProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  className?: string;
}

/**
 * QuickAction — pill de sugestão reutilizável (Nova Experience — Fase 1).
 * Usada abaixo do `NovaInput` para exemplificar comandos ("Organizar meu
 * dia", "Ver financeiro"). Puramente visual/local — `onClick` é opcional e
 * não dispara nenhuma chamada real ainda.
 */
export function QuickAction({ icon: Icon, label, onClick, className }: QuickActionProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      {...hoverSubtle}
      className={cn(
        'flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-text-secondary backdrop-blur-sm transition-colors duration-fast ease-out hover:border-white/20 hover:bg-white/[0.08] hover:text-text-primary',
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </motion.button>
  );
}
