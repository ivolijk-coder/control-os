import * as React from 'react';

export interface SectionHeaderProps {
  title: string;
  description?: string;
  /** Texto curto à direita (ex.: contagem, "3 compromissos"). */
  meta?: string;
  /** Nó opcional à direita (ex.: botão), no lugar de `meta`. */
  action?: React.ReactNode;
  /** `page` = título da tela (maior); `section` = título de bloco dentro da tela. Padrão: `section`. */
  level?: 'page' | 'section';
}

/**
 * SectionHeader — cabeçalho reutilizável (CONTROL OS — Etapa 10B).
 *
 * Substitui o padrão repetido em quase toda página de módulo (`<h1>` ou
 * `<h2>` + contagem à direita, escrito à mão em cada arquivo). Mesma
 * hierarquia tipográfica em todo o CONTROL OS — level="page" pro título da
 * tela, level="section" pros blocos dentro dela (ex.: "Dívidas",
 * "Lançamentos").
 */
export function SectionHeader({ title, description, meta, action, level = 'section' }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2
          className={
            level === 'page'
              ? 'text-lg font-semibold tracking-tight text-text-primary'
              : 'text-sm font-medium text-text-primary'
          }
        >
          {title}
        </h2>
        {description && <p className="text-xs text-text-tertiary">{description}</p>}
      </div>
      {action ? (
        <div className="shrink-0">{action}</div>
      ) : meta ? (
        <span className="shrink-0 text-xs text-text-tertiary">{meta}</span>
      ) : null}
    </div>
  );
}
