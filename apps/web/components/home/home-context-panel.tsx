'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CalendarClock, Repeat, Sparkles, Trophy, Wallet, type LucideIcon } from 'lucide-react';
import { buildHomeInsights, generateRecommendations, toReadOnlyContext } from '@/services/nova';
import type { NovaRecommendationCategory } from '@/services/nova';
import { fadeUp, staggerContainer } from '@/lib/motion';
import { useNovaContext } from '@/lib/use-nova-context';
import { InsightCard, type InsightCardProps } from '@/components/dashboard/insight-card';
import { MissionCard } from '@/components/dashboard/mission-card';

/**
 * Categorias do Recommendation Engine (`services/nova/recommendations`) que
 * sinalizam risco/atenção — vira a seção "Alertas". As demais duas
 * (`concluir_habitos`, `antecipar_metas`) viram "Oportunidades" — nenhuma
 * categoria nova, só uma leitura em dois grupos do que o engine já produz.
 */
const ALERT_CATEGORIES: NovaRecommendationCategory[] = ['reduzir_gastos', 'revisar_gastos', 'reorganizar_agenda', 'priorizar_tarefas'];

/**
 * Escolhe um ícone/acento pro bullet (CONTROL OS — Etapa 10B) só a partir do
 * texto que `buildHomeInsights` já devolve — não muda a Etapa 9, só decide
 * como desenhar cada frase que ela já gera, na mesma ordem previsível
 * (gasto → hábitos → meta → agenda → sugestão da Nova).
 */
function classifyInsight(text: string): { icon: LucideIcon; accent: InsightCardProps['accent'] } {
  if (/gastou/i.test(text)) return { icon: Wallet, accent: 'blue' };
  if (/hábito/i.test(text)) return { icon: Repeat, accent: 'green' };
  if (/meta ".*" está/i.test(text)) return { icon: Trophy, accent: 'purple' };
  if (/\bàs\b|hoje\.$/i.test(text)) return { icon: CalendarClock, accent: 'blue' };
  return { icon: Sparkles, accent: 'purple' };
}

/**
 * HomeContextPanel — CONTROL OS Etapa 11.
 *
 * Extraído de `HomeHero` (que até a Etapa 10B renderizava resumo/insights
 * junto da saudação, ANTES da esfera). O spec da Etapa 11 pede duas coisas
 * que colidem em telas pequenas: (1) a ordem conceitual "saudação → resumo →
 * alertas → oportunidades → missões → Grande Orb Viva"; e (2) "Mobile-first:
 * NOVA grande/central/sozinha ao abrir, módulos abaixo". Numa tela de
 * celular, os cards de resumo/alertas/oportunidades/missões sozinhos já
 * ocupam mais que uma tela inteira — deixando a esfera enterrada abaixo da
 * dobra, o oposto de "sozinha ao abrir".
 *
 * A resolução: a esfera vira o primeiro elemento de peso visual em
 * `NovaWorkspace` (variant="docked"), e este painel — com todo o mesmo
 * conteúdo e nenhuma lógica nova (mesmo `buildHomeInsights`,
 * `generateRecommendations`, `MissionCard`) — passa a viver logo abaixo dela
 * (`belowOrbContent`), junto do `HomeSummaryStrip`. A saudação
 * (`HomeHero`) continua sozinha acima da esfera — curta, sem cards.
 */
export function HomeContextPanel() {
  const novaContext = useNovaContext();

  const insights = React.useMemo(() => buildHomeInsights(toReadOnlyContext(novaContext)), [novaContext]);
  const recommendations = React.useMemo(() => generateRecommendations(toReadOnlyContext(novaContext)), [novaContext]);
  const alerts = React.useMemo(
    () => recommendations.filter((recommendation) => ALERT_CATEGORIES.includes(recommendation.category)),
    [recommendations]
  );
  const opportunities = React.useMemo(
    () => recommendations.filter((recommendation) => !ALERT_CATEGORIES.includes(recommendation.category)),
    [recommendations]
  );
  const priorityMissions = React.useMemo(
    () =>
      [...novaContext.missions]
        .filter((mission) => mission.status === 'em_risco' || mission.status === 'em_andamento')
        .sort((a, b) => (a.status === 'em_risco' ? -1 : 1) - (b.status === 'em_risco' ? -1 : 1))
        .slice(0, 2),
    [novaContext.missions]
  );

  const hasAnyContent = insights.length > 0 || alerts.length > 0 || opportunities.length > 0 || priorityMissions.length > 0;
  if (!hasAnyContent) return null;

  return (
    <div className="flex w-full flex-col items-center gap-5">
      {insights.length > 0 && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer(0.06, 0.05)}
          className="flex w-full max-w-md flex-col items-center gap-3"
        >
          <motion.p variants={fadeUp} className="text-sm text-text-secondary">
            Hoje encontrei algumas coisas importantes para você.
          </motion.p>
          <div className="flex w-full flex-col gap-2">
            {insights.map((insight) => {
              const { icon, accent } = classifyInsight(insight);
              return (
                <motion.div key={insight} variants={fadeUp}>
                  <InsightCard icon={icon} accent={accent} title={insight} />
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {alerts.length > 0 && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer(0.06, 0.1)}
          className="flex w-full max-w-md flex-col items-center gap-2"
        >
          <motion.span variants={fadeUp} className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
            Alertas
          </motion.span>
          <div className="flex w-full flex-col gap-2">
            {alerts.map((alert) => (
              <motion.div key={alert.category} variants={fadeUp}>
                <InsightCard icon={AlertTriangle} accent="red" title={alert.message} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {opportunities.length > 0 && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer(0.06, 0.15)}
          className="flex w-full max-w-md flex-col items-center gap-2"
        >
          <motion.span variants={fadeUp} className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
            Oportunidades
          </motion.span>
          <div className="flex w-full flex-col gap-2">
            {opportunities.map((opportunity) => (
              <motion.div key={opportunity.category} variants={fadeUp}>
                <InsightCard icon={Sparkles} accent="green" title={opportunity.message} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {priorityMissions.length > 0 && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer(0.06, 0.2)}
          className="flex w-full max-w-lg flex-col items-center gap-2"
        >
          <motion.span variants={fadeUp} className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
            Missões prioritárias
          </motion.span>
          <div className="grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-2">
            {priorityMissions.map((mission) => (
              <motion.div key={mission.id} variants={fadeUp}>
                <MissionCard mission={mission} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
