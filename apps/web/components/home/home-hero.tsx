'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { blurIn, transitionOut } from '@/lib/motion';
import { useNovaContext } from '@/lib/use-nova-context';

/** Saudação por horário do dia — parte do "parecer uma conversa", não um dashboard. */
function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * HomeHero — CONTROL OS Etapa 12A: "1. Saudação — grande, centralizada,
 * abaixo apenas uma frase curta... nada além disso."
 *
 * Até a Etapa 12A este componente também carregava um botão ("Converse com
 * a Nova") e, em versões anteriores, um resumo inteiro do dia. Os dois
 * saíram daqui: o microfone inline do campo de conversa (Etapa 11C) já
 * cobre a ação de falar com a NOVA, e o resumo do dia virou
 * `HomeTopInsights` (no máximo 3 cartões, abaixo da esfera). Sobra só a
 * saudação e uma única frase — a NOVA afirmando que já trabalhou, nunca
 * perguntando "como posso ajudar" ("a NOVA precisa tomar a iniciativa").
 *
 * A frase muda conforme existe ou não algo real pra reportar (mesmo
 * `NovaContext` que `HomeTopInsights` usa, verificação independente e
 * barata — só checa se há dado, não recalcula os cartões) — nunca um texto
 * fixo desconectado da conta que `HomeTopInsights` mostra logo abaixo.
 */
export function HomeHero({ firstName }: { firstName: string }) {
  const { financeEntries, habits, missions } = useNovaContext();

  const hasSomethingToReport =
    financeEntries.some((entry) => entry.type === 'despesa') || habits.length > 0 || missions.length > 0;

  const subtitle = hasSomethingToReport
    ? 'Analisei seu dia e encontrei algumas oportunidades.'
    : 'Está tudo em ordem por aqui.';

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={blurIn}
      transition={transitionOut(0.4)}
      className="flex flex-col items-center gap-2 pb-2 pt-14 text-center"
    >
      <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
        {getTimeOfDayGreeting()}, {firstName}.
      </h1>
      <p className="text-sm text-text-secondary">{subtitle}</p>
    </motion.section>
  );
}
