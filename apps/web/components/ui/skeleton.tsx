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
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-shimmer rounded-md bg-tint/[0.06] bg-[length:200%_100%] bg-[linear-gradient(110deg,rgba(255,255,255,0.06)_40%,rgba(255,255,255,0.14)_50%,rgba(255,255,255,0.06)_60%)]',
        className
      )}
      aria-hidden
    />
  );
}
