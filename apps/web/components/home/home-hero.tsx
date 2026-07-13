'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, Mic, Repeat, Sparkles, Trophy, Wallet, type LucideIcon } from 'lucide-react';
import { buildHomeInsights, toReadOnlyContext } from '@/services/nova';
import { blurIn, fadeUp, hoverLift, staggerContainer, transitionOut } from '@/lib/motion';
import { useAppStore } from '@/lib/store';
import { useNovaContext } from '@/lib/use-nova-context';
import { InsightCard, type InsightCardProps } from '@/components/dashboard/insight-card';

/** Saudação por horário do dia — parte do "parecer uma conversa", não um dashboard. */
function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

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
 * HomeHero — a Home deixa de parecer um dashboard e passa a parecer uma
 * conversa (CONTROL OS — Etapa 9: NOVA Experience — "a NOVA passa a ser o
 * centro do CONTROL OS"). Sob a saudação por horário, um resumo inteligente
 * real — nunca genérico — gerado por `buildHomeInsights` (CONTROL OS —
 * Etapa 9, `services/nova/insights`), que por sua vez reaproveita o
 * Recommendation Engine já existente (Etapa 7) pra sugestão final. Sempre
 * que o usuário abre o sistema, este resumo é recalculado na hora, a partir
 * do mesmo `NovaContext` real que a conversa usa (`useNovaContext`) — nunca
 * um valor engessado.
 *
 * Continua sendo só a saudação: o campo de texto, sugestões rápidas,
 * conversa e painel inteligente vivem em `NovaWorkspace`, montado logo
 * abaixo deste componente em `app/(dashboard)/nova/page.tsx`. O CTA de voz
 * (Etapa 8) permanece como a ação principal sugerida.
 *
 * CONTROL OS — Etapa 10B: cada bullet do resumo (mesmo array de string que
 * `buildHomeInsights` sempre devolveu, nenhuma mudança na Etapa 9) agora
 * aparece como um `InsightCard` em vez de um item de lista com "•" — mais
 * "cards inteligentes", zero lógica nova. A Home continua "só a bola" no
 * sentido que importa: nenhuma seção de módulo, nenhum grid de métricas
 * cruzadas — só a mesma saudação e o mesmo resumo, com um verniz visual
 * melhor.
 */
export function HomeHero({ firstName }: { firstName: string }) {
  const setNovaVoiceOpen = useAppStore((state) => state.setNovaVoiceOpen);
  const novaContext = useNovaContext();

  const insights = React.useMemo(() => buildHomeInsights(toReadOnlyContext(novaContext)), [novaContext]);

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={blurIn}
      transition={transitionOut(0.4)}
      className="flex flex-col items-center gap-5 pb-8 pt-14 text-center"
    >
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
          {getTimeOfDayGreeting()}, {firstName}.
        </h1>
        {insights.length === 0 && <p className="text-sm text-text-secondary">Como posso ajudar você hoje?</p>}
      </div>

      {insights.length > 0 && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer(0.06, 0.15)}
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

      <motion.button
        type="button"
        onClick={() => setNovaVoiceOpen(true)}
        {...hoverLift}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-accent-purple px-5 py-2.5 text-sm font-medium text-white shadow-e3"
      >
        <Mic className="h-4 w-4" />
        Converse com a Nova
      </motion.button>
    </motion.section>
  );
}
