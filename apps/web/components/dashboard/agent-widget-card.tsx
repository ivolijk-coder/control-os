'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { useDataStore } from '@/lib/data-store';
import { cn, formatCurrency } from '@/lib/utils';
import { NovaRingObject } from '@/components/nova/nova-ring-object';
import { LegendaryCrystalObject } from '@/components/nova/legendary-crystal-object';
import { AiPanelGlow } from '@/components/dashboard/ai-panel-glow';
import type { NovaPersona } from '@/services/nova';

const TOGGLE_OPTIONS: ReadonlyArray<{ value: NovaPersona; label: string }> = [
  { value: 'nova', label: 'NOVA' },
  { value: 'legendary', label: 'LEGENDARY' },
];

const PLACEHOLDER_BY_PERSONA: Record<NovaPersona, string> = {
  nova: '"organize meu dia"',
  legendary: '"como está minha empresa?"',
};

const SUGGESTIONS_BY_PERSONA: Record<NovaPersona, string[]> = {
  nova: ['Ver hábitos pendentes', 'Priorizar o que está em risco', 'Registrar uma despesa'],
  legendary: ['Revisar minha estratégia', 'Analisar meu maior gargalo', 'Definir prioridade da semana'],
};

/**
 * CONTROL OS — Home/Dashboard (Design Lab → implementação oficial):
 * widget NOVA/LEGENDARY, agora um CARD dentro da grade — nunca mais o
 * hero de tela cheia (ver HANDOFF-control-os-design.md, "O que NÃO
 * fazer"). Réplica fiel de `.agent-card` em `control-os-dashboard.html`.
 *
 * Anel e cristal são CSS puro (sem React Three Fiber, sem partículas) —
 * decisão deliberada do HANDOFF: "não usar esfera espacial, partículas,
 * glow excessivo, ou estética 'demo de Three.js'". Isso é um widget
 * DIFERENTE do Hero Object grande de `/nova` (`nova-hero-stage.tsx`) — não
 * compartilha componente com ele porque o tamanho, o contexto (dentro de
 * um card compacto, ao lado de texto) e a decisão de nunca usar R3F aqui
 * são todos diferentes. As animações de giro do anel e shimmer do cristal
 * usam Framer Motion (`animate` com `repeat: Infinity`), o mesmo motor de
 * animação já usado no resto do produto, em vez de introduzir `@keyframes`
 * CSS novos.
 *
 * O toggle usa `activePersona`/`setActivePersona` do `useAppStore` — o
 * MESMO estado global que dirige o resto da conversa com a Nova (Etapa
 * 15) — nunca um segundo estado de persona paralelo e divergente.
 */
export function AgentWidgetCard() {
  const persona = useAppStore((s) => s.activePersona);
  const setPersona = useAppStore((s) => s.setActivePersona);
  const setNovaPanelOpen = useAppStore((s) => s.setNovaPanelOpen);
  const debts = useDataStore((s) => s.debts);
  const financeEntries = useDataStore((s) => s.financeEntries);

  const dividasTotal = React.useMemo(() => debts.reduce((sum, debt) => sum + debt.remainingAmount, 0), [debts]);
  const saldo = React.useMemo(() => {
    const receitaTotal = financeEntries.filter((e) => e.type === 'receita').reduce((sum, e) => sum + e.amount, 0);
    const gastosTotal = financeEntries.filter((e) => e.type === 'despesa').reduce((sum, e) => sum + e.amount, 0);
    return receitaTotal - gastosTotal;
  }, [financeEntries]);

  // Linha da NOVA: mesma fórmula real que o módulo Financeiro já usa
  // (dívidas em aberto vs. saldo) — nunca um motor de insight novo (o
  // HANDOFF lista "definir a lógica real por trás das anotações da NOVA"
  // como fora de escopo desta implementação). LEGENDARY não tem dado real
  // equivalente (nenhuma "estratégia de crescimento %" existe no sistema)
  // — mantém o texto do protótipo como placeholder.
  const novaAgentLine =
    dividasTotal > saldo ? (
      <>
        Suas dívidas em aberto somam <b className="text-[#EAF4FF]">{formatCurrency(dividasTotal)}</b>, mais que seu
        saldo atual — seu fluxo de caixa merece atenção.
      </>
    ) : (
      <>
        Seu saldo atual é <b className="text-[#EAF4FF]">{formatCurrency(saldo)}</b>, dívidas em aberto somam{' '}
        {formatCurrency(dividasTotal)}.
      </>
    );
  const legendaryAgentLine = (
    <>
      <b className="text-[#EAF4FF]">&quot;Disciplina hoje é a liberdade que você terá amanhã.&quot;</b> Sua
      estratégia de crescimento está 82% no plano.
    </>
  );

  const openPanel = () => setNovaPanelOpen(true);

  // AiPanelGlow embrulha o card por fora, sem tocar em nenhuma classe ou
  // filho abaixo — "não altere layout, tamanho ou componentes internos,
  // quero apenas transformar esse card no ponto focal da interface"
  // (pedido explícito do usuário). Ver `ai-panel-glow.tsx`.
  return (
    <AiPanelGlow persona={persona}>
    <div className="flex flex-col items-start gap-6 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0e0f11] p-5 sm:flex-row sm:items-center sm:gap-7 sm:p-6">
      <div className="flex shrink-0 flex-col gap-2.5">
        <div className="flex gap-1.5 rounded-full border border-[rgba(255,255,255,0.07)] bg-[#101215] p-1">
          {TOGGLE_OPTIONS.map((option) => {
            const active = option.value === persona;
            const isLegendary = option.value === 'legendary';
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setPersona(option.value)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-[11px] tracking-wide transition-colors duration-150',
                  active
                    ? isLegendary
                      ? 'border border-[rgba(244,216,137,0.3)] bg-[rgba(201,150,47,0.12)] text-[#F4D889]'
                      : 'border border-[rgba(79,216,255,0.3)] bg-[rgba(11,99,246,0.12)] text-[#4FD8FF]'
                    : 'border border-transparent text-[#6b6f76]'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <AgentStage persona={persona} />
      </div>

      <div className="w-full min-w-0 flex-1">
        <div className="mb-3 text-[13px] leading-[1.5] text-[#c7cbd1]">
          {persona === 'nova' ? novaAgentLine : legendaryAgentLine}
        </div>

        <button
          type="button"
          onClick={openPanel}
          className="mb-2.5 flex w-full items-center gap-2.5 rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#101215] px-3.5 py-2.5 text-left text-[12px] text-[#55585e] transition-colors duration-150 hover:border-[rgba(255,255,255,0.16)]"
        >
          <span className="flex-1">{PLACEHOLDER_BY_PERSONA[persona]}</span>
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#4FD8FF] text-[10px] text-[#08090b]">
            ↑
          </span>
        </button>

        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS_BY_PERSONA[persona].map((pill) => (
            <button
              key={pill}
              type="button"
              onClick={openPanel}
              className="rounded-[20px] border border-[rgba(255,255,255,0.08)] px-3 py-[5px] text-[11px] text-[#9a9ea4] transition-colors duration-150 hover:border-[rgba(255,255,255,0.16)] hover:text-[#EAF4FF]"
            >
              {pill}
            </button>
          ))}
        </div>
      </div>
    </div>
    </AiPanelGlow>
  );
}

/**
 * CONTROL OS — botão flutuante global: `NovaRingObject`/`LegendaryCrystalObject`
 * viraram componentes reutilizáveis com `size` (antes eram funções locais
 * `NovaRingMini`/`LegendaryCrystalMini` só deste arquivo) — "o mesmo
 * objeto, materiais, iluminação e animações" precisa ser reaproveitado
 * também no popover de `NovaFloatingLauncher`, nunca uma terceira versão
 * desenhada à parte.
 */
function AgentStage({ persona }: { persona: NovaPersona }) {
  return (
    <div className="relative h-24 w-24 shrink-0">
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ opacity: persona === 'nova' ? 1 : 0, scale: persona === 'nova' ? 1 : 0.9 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{ pointerEvents: persona === 'nova' ? 'auto' : 'none' }}
      >
        <NovaRingObject size={84} />
      </motion.div>
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ opacity: persona === 'legendary' ? 1 : 0, scale: persona === 'legendary' ? 1 : 0.9 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{ pointerEvents: persona === 'legendary' ? 'auto' : 'none' }}
      >
        <LegendaryCrystalObject size={66} />
      </motion.div>
    </div>
  );
}
