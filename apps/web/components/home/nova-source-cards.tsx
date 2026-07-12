'use client';

import { motion } from 'framer-motion';
import { Bell, CalendarClock, Wallet, type LucideIcon } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { useDataStore } from '@/lib/data-store';
import { formatCurrency } from '@/lib/utils';
import { fadeUp, staggerContainer } from '@/lib/motion';

function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(date));
}

interface SourceCard {
  id: string;
  icon: LucideIcon;
  label: string;
  count: number;
  previewTitle: string | null;
  previewMeta: string | null;
}

/**
 * NovaSourceCards — cartões estilo "caixa de entrada" (CONTROL OS —
 * Etapa 3, estilo inspirado em referência visual enviada pelo usuário):
 * Lembretes, Compromissos e Transações, cada um com o item mais próximo
 * como prévia. Diferente do `IntelligentPanel` (métricas agregadas), aqui
 * é lista de itens reais do `useDataStore` — sem fingir nenhuma integração
 * externa (Google Agenda, banco) que não existe.
 */
export function NovaSourceCards() {
  const missions = useDataStore((state) => state.missions);
  const agendaEvents = useDataStore((state) => state.agendaEvents);
  const financeEntries = useDataStore((state) => state.financeEntries);

  const lembretes = missions.filter((mission) => mission.status === 'planejamento');
  const proximoLembrete = lembretes[0] ?? null;

  const compromissosOrdenados = [...agendaEvents].sort((a, b) => a.date.localeCompare(b.date));
  const proximoCompromisso = compromissosOrdenados[0] ?? null;

  const transacoesOrdenadas = [...financeEntries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const ultimaTransacao = transacoesOrdenadas[0] ?? null;

  const cards: SourceCard[] = [
    {
      id: 'lembretes',
      icon: Bell,
      label: 'Lembretes',
      count: lembretes.length,
      previewTitle: proximoLembrete?.title ?? null,
      previewMeta: proximoLembrete?.dueDate ? formatShortDate(proximoLembrete.dueDate) : null,
    },
    {
      id: 'compromissos',
      icon: CalendarClock,
      label: 'Compromissos',
      count: agendaEvents.length,
      previewTitle: proximoCompromisso?.title ?? null,
      previewMeta: proximoCompromisso
        ? `${formatShortDate(proximoCompromisso.date)}${proximoCompromisso.time ? ` · ${proximoCompromisso.time}` : ''}`
        : null,
    },
    {
      id: 'transacoes',
      icon: Wallet,
      label: 'Transações',
      count: financeEntries.length,
      previewTitle: ultimaTransacao?.description ?? null,
      previewMeta: ultimaTransacao
        ? `${ultimaTransacao.type === 'receita' ? '+' : '-'}${formatCurrency(ultimaTransacao.amount)}`
        : null,
    },
  ];

  const visibleCards = cards.filter((card) => card.count > 0);
  if (visibleCards.length === 0) return null;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer(0.06)}
      className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {visibleCards.map((card) => {
        const Icon = card.icon;
        return (
          <motion.div key={card.id} variants={fadeUp}>
            <GlassCard interactive={false} className="h-full p-4">
              <div className="flex items-center gap-2 text-text-secondary">
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="text-xs font-medium uppercase tracking-wider">{card.label}</span>
                <span className="ml-auto shrink-0 text-xs text-text-tertiary">{card.count}</span>
              </div>
              {card.previewTitle && (
                <div className="mt-2.5">
                  <p className="truncate text-sm text-text-primary">{card.previewTitle}</p>
                  {card.previewMeta && <p className="mt-0.5 text-xs text-text-tertiary">{card.previewMeta}</p>}
                </div>
              )}
            </GlassCard>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
