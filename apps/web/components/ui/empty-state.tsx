import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}

/**
 * EmptyState — estado vazio reutilizável (CONTROL OS — Etapa 10B).
 *
 * Substitui o `GlassCard` com texto solto repetido em toda página de módulo
 * ("Nenhum ... ainda"). Ícone opcional deixa o estado vazio menos "erro" e
 * mais "quadro em branco pronto pra usar".
 */
export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <GlassCard interactive={false} className={cn('flex flex-col items-center gap-2 p-10 text-center', className)}>
      {Icon && (
        <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-text-tertiary">
          <Icon className="h-4 w-4" />
        </span>
      )}
      <p className="text-sm text-text-secondary">{title}</p>
      {description && <p className="max-w-sm text-xs text-text-tertiary">{description}</p>}
    </GlassCard>
  );
}
