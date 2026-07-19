import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DataCardListRow {
  label: string;
  value: string;
}

export interface DataCardProps {
  label: string;
  value?: string;
  description?: string;
  listRows?: DataCardListRow[];
  /** Nota inline da NOVA (a "notinha tracejada" com o marcador "N") — só aparece quando há algo relevante a dizer, nunca em todo card. */
  novaNote?: string;
  /** `wide` = 2 colunas no grid de 4; `default` = 1 coluna. */
  span?: 'default' | 'wide';
  className?: string;
  /**
   * Conteúdo livre entre `listRows` e `novaNote` — usado para embutir os
   * mini-gráficos existentes (`MiniSparkline`, `MiniBarChart`, etc. de
   * `mini-charts.tsx`) sem criar um segundo componente de card paralelo
   * (Reorganização da Home / "quatro pilares": Financeiro precisa do
   * sparkline de fluxo de caixa, Hábitos do gráfico de evolução semanal —
   * ambos dentro do MESMO card visual usado em toda a Home).
   */
  children?: React.ReactNode;
}

/**
 * CONTROL OS — Home/Dashboard (Design Lab → implementação oficial):
 * card operacional genérico da grade da Home. Réplica fiel de `.card` em
 * `control-os-dashboard.html` — label pequeno em caixa alta, valor grande,
 * descrição discreta, linhas de lista opcionais, nota da NOVA opcional.
 *
 * Paleta em hex literal (não os tokens `bg`/`card`/`text-primary` do resto
 * do app) porque o HANDOFF pediu explicitamente para manter a paleta do
 * protótipo exatamente como está, sem ajustar tons — ver
 * `HANDOFF-control-os-design.md`, tabela "Paleta usada no protótipo".
 */
export function DataCard({
  label,
  value,
  description,
  listRows,
  novaNote,
  span = 'default',
  className,
  children,
}: DataCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-[10px] rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0e0f11] p-[18px]',
        span === 'wide' && 'sm:col-span-2',
        className
      )}
    >
      <div className="text-[10px] tracking-[1px] text-[#55585e]">{label}</div>

      {value && <div className="text-[21px] font-semibold text-[#EAF4FF]">{value}</div>}
      {description && <div className="text-[11px] text-[#55585e]">{description}</div>}

      {listRows && listRows.length > 0 && (
        <div className="flex flex-col">
          {listRows.map((row, index) => (
            <div
              key={`${row.label}-${index}`}
              className={cn(
                'flex justify-between py-[5px] text-[12px] text-[#9a9ea4]',
                index < listRows.length - 1 && 'border-b border-[rgba(255,255,255,0.04)]'
              )}
            >
              <span className="truncate pr-3">{row.label}</span>
              <span className="shrink-0">{row.value}</span>
            </div>
          ))}
        </div>
      )}

      {children}

      {novaNote && (
        <div className="mt-1 flex items-start gap-2 border-t border-dashed border-[rgba(79,216,255,0.18)] pt-[10px] text-[11.5px] leading-[1.5] text-[#9cc7e8]">
          <div className="mt-[1px] flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full bg-[rgba(79,216,255,0.12)] text-[9px] font-semibold text-[#4FD8FF]">
            N
          </div>
          <span>{novaNote}</span>
        </div>
      )}
    </div>
  );
}
