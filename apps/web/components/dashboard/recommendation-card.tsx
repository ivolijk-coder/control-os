import * as React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RecommendationCardProps {
  text: string;
  className?: string;
}

/**
 * RecommendationCard — "resumo gerado pela NOVA" (CONTROL OS — Etapa 10B).
 *
 * Importante: isto NÃO chama a IA/Conversation Service/Recommendation
 * Engine (fora de escopo desta etapa, que é só visual). O texto é sempre
 * calculado por uma função pura local, a partir de dado já existente no
 * `useDataStore` (mesmo padrão do `buildHomeInsights` da Etapa 9) — só o
 * enquadramento visual sugere a Nova "comentando" o módulo.
 */
export function RecommendationCard({ text, className }: RecommendationCardProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-accent-purple/20 bg-accent-purple/[0.06] p-4 backdrop-blur-sm',
        className
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-purple/15 text-accent-purple">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <p className="text-sm leading-snug text-text-primary">{text}</p>
    </div>
  );
}
