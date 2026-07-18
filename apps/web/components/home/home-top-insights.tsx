'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { fadeUp, staggerContainer } from '@/lib/motion';
import { useNovaContext } from '@/lib/use-nova-context';
import { formatCurrency } from '@/lib/utils';

type InsightAccent = 'purple' | 'blue' | 'green' | 'red';

interface TopInsight {
  key: string;
  icon: LucideIcon;
  accent: InsightAccent;
  title: string;
  value: string;
  actionLabel: string;
  href: string;
}

const ACCENT_TEXT: Record<InsightAccent, string> = {
  purple: 'text-accent-purple',
  blue: 'text-accent-blue',
  green: 'text-accent-green',
  red: 'text-accent-red',
};

/**
 * HomeTopInsights — CONTROL OS Etapa 12A: "nunca mais de três."
 *
 * Substitui o antigo `HomeContextPanel` (Etapa 11), que somava resumo do
 * dia + Alertas + Oportunidades + Missões prioritárias — podia passar de
 * dez cards na tela ao mesmo tempo, exatamente a "poluição visual" que essa
 * etapa pede pra eliminar. Este componente cobre 3 áreas fixas (maior gasto
 * do mês, hábitos pendentes hoje, missão/meta em destaque) e cada cartão só
 * aparece se houver dado real pra ele — nunca preenche um espaço vazio com
 * valor inventado, e nunca ultrapassa 3, mesmo que as 3 áreas tenham dado.
 *
 * Cada cartão segue exatamente o formato pedido: título, número, botão —
 * nada mais (sem descrição longa, sem lista secundária). O botão leva
 * direto ao módulo correspondente; nenhuma ação nova, só navegação para
 * rotas que já existem.
 */
export function HomeTopInsights() {
  const { financeEntries, habits, missions } = useNovaContext();

  const insights = React.useMemo<TopInsight[]>(() => {
    const result: TopInsight[] = [];

    // Financeiro — maior categoria de gasto do mês (mesmo agrupamento usado
    // em `financeiro/page.tsx`). Sem despesas registradas, nenhum cartão.
    const despesas = financeEntries.filter((entry) => entry.type === 'despesa');
    if (despesas.length > 0) {
      const totals = new Map<string, number>();
      for (const entry of despesas) {
        totals.set(entry.category, (totals.get(entry.category) ?? 0) + entry.amount);
      }
      const topEntry = Array.from(totals).sort((a, b) => b[1] - a[1])[0];
      if (topEntry) {
        const [topCategory, topValue] = topEntry;
        result.push({
          key: 'financeiro',
          icon: Wallet,
          accent: 'blue',
          title: `Maior gasto: ${topCategory}`,
          value: formatCurrency(topValue),
          actionLabel: 'Ver Financeiro',
          href: '/financeiro',
        });
      }
    }

    // Hábitos — pendentes hoje. Mostra mesmo quando é zero (boa notícia
    // também é um insight válido); só some se não houver nenhum hábito.
    if (habits.length > 0) {
      const pendentes = habits.filter((habit) => !habit.completedToday).length;
      result.push({
        key: 'habitos',
        icon: CheckCircle2,
        accent: pendentes === 0 ? 'green' : 'purple',
        title: pendentes === 0 ? 'Hábitos concluídos hoje' : 'Hábitos pendentes',
        value: pendentes === 0 ? `${habits.length}/${habits.length}` : String(pendentes),
        actionLabel: 'Ver Hábitos',
        href: '/habitos',
      });
    }

    // Missão/meta em destaque — prioriza risco (mais urgente), senão a de
    // maior progresso em andamento (mais perto de concluir).
    const emRisco = missions.filter((mission) => mission.status === 'em_risco');
    const emAndamento = [...missions]
      .filter((mission) => mission.status === 'em_andamento')
      .sort((a, b) => b.progress - a.progress);
    const destaque = emRisco[0] ?? emAndamento[0];
    if (destaque) {
      result.push({
        key: 'missao',
        icon: TrendingUp,
        accent: destaque.status === 'em_risco' ? 'red' : 'green',
        title: destaque.title,
        value: `${destaque.progress}%`,
        actionLabel: 'Ver Missões',
        href: '/missoes',
      });
    }

    return result.slice(0, 3);
  }, [financeEntries, habits, missions]);

  if (insights.length === 0) return null;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer(0.07, 0.1)}
      className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {insights.map((insight) => (
        <motion.div key={insight.key} variants={fadeUp}>
          <GlassCard glow={insight.accent} className="flex h-full flex-col gap-3 p-5">
            <div className="flex items-center gap-2">
              <insight.icon className={`h-4 w-4 shrink-0 ${ACCENT_TEXT[insight.accent]}`} aria-hidden />
              <p className="truncate text-xs font-medium text-text-secondary">{insight.title}</p>
            </div>
            <p className="font-mono text-2xl font-semibold tracking-tight text-text-primary">{insight.value}</p>
            <Link
              href={insight.href}
              className={`mt-auto flex items-center gap-1 text-xs font-medium transition-opacity duration-fast ease-out hover:opacity-80 ${ACCENT_TEXT[insight.accent]}`}
            >
              {insight.actionLabel}
              <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </GlassCard>
        </motion.div>
      ))}
    </motion.div>
  );
}
