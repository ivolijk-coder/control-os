import * as React from 'react';
import { cn } from '@/lib/utils';

export type ChartAccent = 'purple' | 'blue' | 'green' | 'red';

const BAR_ACCENT: Record<ChartAccent, string> = {
  purple: 'bg-accent-purple',
  blue: 'bg-accent-blue',
  green: 'bg-accent-green',
  red: 'bg-accent-red',
};

const DONUT_ACCENT_HEX: Record<ChartAccent, string> = {
  purple: '#8b5cf6',
  blue: '#3b82f6',
  green: '#22c55e',
  red: '#ef4444',
};

/**
 * Mini-gráficos em SVG/CSS puro (CONTROL OS — Etapa 10B) — nenhuma lib de
 * gráfico nova (o pedido explícito era evitar libs pesadas). Cada um lê
 * exatamente o array que o módulo já calculou a partir de `useDataStore`;
 * nenhum aqui inventa dado, só desenha o que recebe.
 */

export interface MiniBarChartDatum {
  label: string;
  value: number;
  displayValue: string;
  accent?: ChartAccent;
}

/** Barras horizontais escaladas pelo maior valor — usado em "gastos por categoria". */
export function MiniBarChart({ data }: { data: MiniBarChartDatum[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex flex-col gap-3">
      {data.map((datum) => (
        <div key={datum.label} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">{datum.label}</span>
            <span className="font-mono text-text-tertiary">{datum.displayValue}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={cn('h-full rounded-full transition-[width] duration-slow ease-out', BAR_ACCENT[datum.accent ?? 'purple'])}
              style={{ width: `${Math.max(4, (datum.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface MiniDonutDatum {
  label: string;
  value: number;
  accent: ChartAccent;
}

/** Donut de distribuição via `conic-gradient` — sem lib de gráfico. */
export function MiniDonutChart({
  data,
  centerLabel,
  centerValue,
}: {
  data: MiniDonutDatum[];
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  let cursor = 0;
  const stops = data
    .map((datum) => {
      const start = (cursor / total) * 360;
      cursor += datum.value;
      const end = (cursor / total) * 360;
      return `${DONUT_ACCENT_HEX[datum.accent]} ${start}deg ${end}deg`;
    })
    .join(', ');

  return (
    <div className="flex items-center gap-5">
      <div
        className="relative h-28 w-28 shrink-0 rounded-full"
        style={{ background: data.length > 0 ? `conic-gradient(${stops})` : 'transparent' }}
      >
        <div className="absolute inset-2.5 flex flex-col items-center justify-center rounded-full bg-card">
          {centerValue && <span className="font-mono text-sm font-semibold text-text-primary">{centerValue}</span>}
          {centerLabel && <span className="text-[10px] text-text-tertiary">{centerLabel}</span>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {data.map((datum) => (
          <div key={datum.label} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: DONUT_ACCENT_HEX[datum.accent] }} />
            <span className="min-w-0 flex-1 truncate text-text-secondary">{datum.label}</span>
            <span className="font-mono text-text-tertiary">{Math.round((datum.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Grade "últimos 7 dias" por linha — extensão em heatmap do que a página de Hábitos já desenhava por hábito individual. */
export function WeekHeatmap({
  rows,
  dayLabels,
}: {
  rows: { id: string; label: string; days: boolean[] }[];
  dayLabels: string[];
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs text-text-secondary">{row.label}</span>
          <div className="flex flex-1 items-center gap-1.5">
            {row.days.map((done, dayIndex) => (
              <span
                key={dayIndex}
                title={dayLabels[dayIndex]}
                className={cn(
                  'h-5 flex-1 rounded-[4px]',
                  done ? 'bg-accent-green/70' : 'bg-white/[0.06]'
                )}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Linha/área acumulada simples — usada no fluxo financeiro do mês. */
export function MiniSparkline({ values, accent = 'purple' }: { values: number[]; accent?: ChartAccent }) {
  if (values.length < 2) {
    return <p className="text-xs text-text-tertiary">Poucos lançamentos ainda para desenhar o fluxo do mês.</p>;
  }

  const width = 280;
  const height = 72;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });

  const areaPath = `M0,${height} L${points.join(' L')} L${width},${height} Z`;
  const linePath = `M${points.join(' L')}`;
  const gradientId = `sparkline-${accent}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={DONUT_ACCENT_HEX[accent]} stopOpacity="0.35" />
          <stop offset="100%" stopColor={DONUT_ACCENT_HEX[accent]} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <path d={linePath} fill="none" stroke={DONUT_ACCENT_HEX[accent]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
