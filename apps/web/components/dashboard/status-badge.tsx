import * as React from 'react';
import { Badge } from '@control-os/ui';
import type { MissionStatus } from '@control-os/types';
import { cn } from '@/lib/utils';

/**
 * Mapas de status de Missão — centralizados aqui (CONTROL OS — Etapa 10B).
 * Antes existiam como constantes idênticas duplicadas em `mission-card.tsx`
 * e `app/(dashboard)/missoes/page.tsx`; nenhuma mudança de significado, só
 * uma única fonte da verdade.
 */
export const MISSION_STATUS_LABEL: Record<MissionStatus, string> = {
  planejamento: 'Planejamento',
  em_andamento: 'Em andamento',
  em_risco: 'Em risco',
  concluida: 'Concluída',
};

export const MISSION_STATUS_VARIANT: Record<MissionStatus, 'neutral' | 'green' | 'blue' | 'purple' | 'red'> = {
  planejamento: 'neutral',
  em_andamento: 'blue',
  em_risco: 'red',
  concluida: 'green',
};

const DOT_CLASSES: Record<'neutral' | 'green' | 'blue' | 'purple' | 'red', string> = {
  neutral: 'bg-text-tertiary',
  green: 'bg-accent-green',
  blue: 'bg-accent-blue',
  purple: 'bg-accent-purple',
  red: 'bg-accent-red',
};

export interface StatusBadgeProps {
  label: string;
  tone: 'neutral' | 'green' | 'blue' | 'purple' | 'red';
  className?: string;
}

/**
 * StatusBadge — `Badge` com um ponto de status à esquerda (CONTROL OS —
 * Etapa 10B). Mesma API visual do `Badge` de `@control-os/ui`, só com um
 * indicador extra que reforça "isso é um estado", não uma etiqueta comum.
 */
export function StatusBadge({ label, tone, className }: StatusBadgeProps) {
  return (
    <Badge variant={tone} className={cn('gap-1.5', className)}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_CLASSES[tone])} aria-hidden />
      {label}
    </Badge>
  );
}

/** Atalho para o caso mais comum: status de Missão direto, sem mapear na mão. */
export function MissionStatusBadge({ status, className }: { status: MissionStatus; className?: string }) {
  return <StatusBadge label={MISSION_STATUS_LABEL[status]} tone={MISSION_STATUS_VARIANT[status]} className={className} />;
}
