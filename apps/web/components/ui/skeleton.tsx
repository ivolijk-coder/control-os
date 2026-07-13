import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Skeleton — placeholder de carregamento (CONTROL OS — Etapa 10B).
 *
 * Uso real, não decorativo: os componentes client-only montados via
 * `next/dynamic(..., { ssr: false })` (`NovaOrb`, `BackgroundNetwork`) agora
 * passam este componente como `loading`, evitando o "pulo" de layout vazio
 * enquanto o chunk do cliente carrega — sem tocar em nenhuma lógica.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-white/[0.06]', className)} aria-hidden />;
}
