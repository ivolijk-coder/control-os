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
 *
 * CONTROL OS — Etapa 12B: `level="page"` foi de `text-lg` (18px) pra
 * `text-2xl` (24px) — os dois níveis ficavam próximos demais em tamanho
 * (18px vs. 14px), então o título da tela não se impunha sobre os títulos
 * de bloco logo abaixo. Como este componente é reusado em praticamente
 * toda página de módulo, o salto de hierarquia agora é sentido no produto
 * inteiro de uma vez.
 *
 * CONTROL OS — Etapa 16G (Art Direction — tipografia): `level="page"` foi
 * de `text-2xl font-semibold` (24px/600) pra `text-3xl font-bold sm:text-4xl`
 * (30px→36px/700) — as MESMAS classes de `HomeHero` (`/nova`). Antes o
 * título de "Bom dia, Ivoli." na Home e o título "Financeiro" no módulo
 * usavam duas escalas diferentes, então a transição entre os dois lugares
 * quebrava a sensação de "mesma obra" pedida na direção de arte. `level=
 * "section"` ganhou `font-semibold` (antes `font-medium`) — não pra crescer
 * em tamanho (o contraste de escala com `page` continua o mesmo, "hierarquia
 * extremamente clara" depende desse salto), só um traço a mais de peso.
 */
export function SectionHeader({ title, description, meta, action, level = 'section' }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2
          className={
            level === 'page'
              ? 'text-3xl font-bold tracking-tight text-text-primary sm:text-4xl'
              : 'text-sm font-semibold text-text-primary'
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
