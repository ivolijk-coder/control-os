import * as React from 'react';
import { Card } from '@control-os/ui';
import { cn } from '@/lib/utils';

export interface ChartCardProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * ChartCard — moldura padrão pra qualquer gráfico leve dos módulos
 * (CONTROL OS — Etapa 10B). Título + descrição opcional no topo, conteúdo
 * (um dos componentes de `mini-charts.tsx`, ou qualquer outro) abaixo —
 * mesma "casca" em todo módulo que tem gráfico, em vez de cada um montar o
 * cabeçalho à mão.
 */
export function ChartCard({ title, description, action, children, className }: ChartCardProps) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-medium text-text-primary">{title}</h3>
          {description && <p className="text-xs text-text-tertiary">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}
