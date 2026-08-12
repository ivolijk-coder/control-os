import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Skeleton — placeholder de carregamento (CONTROL OS — Etapa 10B).
 *
 * Uso real, não decorativo: os componentes client-only montados via
 * `next/dynamic(..., { ssr: false })` (`NovaOrb`, `BackgroundNetwork`) agora
 * passam este componente como `loading`, evitando o "pulo" de layout vazio
 * enquanto o chunk do cliente carrega — sem tocar em nenhuma lógica.
 *
 * CONTROL OS — Etapa 16D (Design System premium): trocado o `animate-pulse`
 * genérico (opacidade subindo/descendo uniforme — lê como "cinza piscando")
 * por um brilho diagonal que varre o bloco da esquerda pra direita
 * (`animate-shimmer`, Etapa 16A/16D em `tailwind.config.ts`) — o padrão de
 * loading "premium" reconhecível da referência, sensação de luz passando
 * por vidro. `bg-[length:200%_100%]` dá ao gradiente espaço pra se mover
 * antes de repetir o ciclo.
 *
 * O gradiente era branco fixo, e branco varrendo uma superfície branca não
 * varre nada: no tema claro o brilho simplesmente não existia. Agora vem de
 * `--shimmer`, declarado uma vez em `globals.css` sobre `--tint-rgb` — a
 * substituição da variável é resolvida no uso, então a MESMA declaração dá
 * branco no escuro e ardósia no claro, sem duplicar regra por tema.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-shimmer rounded-md bg-tint/[0.06] bg-[length:200%_100%] bg-[image:var(--shimmer)]',
        className
      )}
      aria-hidden
    />
  );
}
