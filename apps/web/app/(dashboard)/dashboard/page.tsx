'use client';

import * as React from 'react';
import { AgentWidgetCard } from '@/components/dashboard/agent-widget-card';
import { DataCard } from '@/components/dashboard/data-card';
import { useDataStore } from '@/lib/data-store';
import { formatCurrency } from '@/lib/utils';
import { toLocalDateString } from '@/services/nova';

/**
 * Dashboard / "Visão geral" — Home oficial do CONTROL OS (Design Lab →
 * implementação, ver HANDOFF-control-os-design.md e
 * PROMPT-para-implementacao.md enviados pelo usuário).
 *
 * Decisão de design que substituiu o chat-first anterior: "o protagonista
 * da Home é o SaaS (a operação do usuário), não a IA." O widget
 * NOVA/LEGENDARY (`AgentWidgetCard`) vira o PRIMEIRO card da grade — full
 * width, mesma altura relativa dos outros — nunca mais tela cheia. `/nova`
 * (a conversa completa) continua existindo como rota própria; o acesso
 * rápido à Nova agora é o botão flutuante (`NovaFloatingLauncher`, já
 * montado globalmente em `LayoutPrincipal`) ou este mesmo card.
 *
 * Dados reais onde já existem no sistema (Financeiro, Metas via Missões,
 * Agenda, Documentos) — mockados como placeholder onde o módulo ainda não
 * existe (Projetos, CRM, Automações) ou onde o campo não existe no modelo
 * de dados (ex.: "aguardando revisão" em Documentos). A lógica real por
 * trás das anotações inline da NOVA (quando um alerta "vale a pena"
 * aparecer) é trabalho futuro — HANDOFF, seção "O que a implementação
 * oficial precisa resolver" — por isso as notas de Projetos/Agenda usam o
 * texto exato do protótipo, não um motor de alerta novo.
 */

const CURRENT_MONTH_PREFIX = () => toLocalDateString(new Date()).slice(0, 7);
const PREVIOUS_MONTH_PREFIX = () => {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return toLocalDateString(prevMonth).slice(0, 7);
};

export default function DashboardPage() {
  const financeEntries = useDataStore((s) => s.financeEntries);
  const missions = useDataStore((s) => s.missions);
  const agendaEvents = useDataStore((s) => s.agendaEvents);
  const documents = useDataStore((s) => s.documents);

  // Financeiro — real: faturamento do mês corrente + variação vs. mês
  // anterior, mesma fonte (`financeEntries`) que o módulo Financeiro usa.
  const { faturamentoMes, tendenciaLabel } = React.useMemo(() => {
    const currentPrefix = CURRENT_MONTH_PREFIX();
    const previousPrefix = PREVIOUS_MONTH_PREFIX();
    const revenueFor = (prefix: string) =>
      financeEntries
        .filter((entry) => entry.type === 'receita' && entry.date.startsWith(prefix))
        .reduce((sum, entry) => sum + entry.amount, 0);
    const current = revenueFor(currentPrefix);
    const previous = revenueFor(previousPrefix);
    const delta = previous > 0 ? ((current - previous) / previous) * 100 : null;
    return {
      faturamentoMes: current,
      tendenciaLabel:
        delta === null
          ? 'Faturamento do mês'
          : `Faturamento do mês · ${delta >= 0 ? '+' : ''}${delta.toFixed(1).replace('.', ',')}%`,
    };
  }, [financeEntries]);

  // Metas — real: progresso médio das missões + quantas estão "no ritmo"
  // (todo status que não seja `em_risco`). Não existe tipo `Goal`
  // separado no sistema — Metas já é lido a partir de `missions` em toda
  // parte (ver `app/(dashboard)/metas/page.tsx`).
  const { progressoMedio, noRitmo, totalMetas } = React.useMemo(() => {
    const total = missions.length;
    const avg = total > 0 ? Math.round(missions.reduce((sum, m) => sum + m.progress, 0) / total) : 0;
    const onTrack = missions.filter((m) => m.status !== 'em_risco').length;
    return { progressoMedio: avg, noRitmo: onTrack, totalMetas: total };
  }, [missions]);

  // Agenda de hoje — real, mesmo critério de "hoje" do módulo Agenda
  // (`toLocalDateString`, nunca `toISOString` — bug de fuso já corrigido).
  const todayEvents = React.useMemo(() => {
    const todayIso = toLocalDateString(new Date());
    return agendaEvents
      .filter((event) => event.date === todayIso)
      .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
  }, [agendaEvents]);

  return (
    <div className="flex flex-col gap-3.5 px-6 py-6 sm:px-8">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-4">
          <AgentWidgetCard />
        </div>

        <DataCard
          label="PROJETOS ATIVOS"
          value="12"
          span="wide"
          listRows={[
            { label: 'Campanha Q3 — Cliente Acme', value: '68%' },
            { label: 'Redesign institucional', value: '32%' },
            { label: 'Onboarding automatizado', value: '91%' },
          ]}
          novaNote="A proposta do cliente Acme vence em 2 dias e segue em rascunho. Quer que eu priorize esse projeto amanhã?"
        />

        <DataCard label="FINANCEIRO" value={formatCurrency(faturamentoMes)} description={tendenciaLabel} />

        <DataCard
          label="METAS"
          value={totalMetas > 0 ? `${progressoMedio}%` : '—'}
          description={totalMetas > 0 ? `${noRitmo} de ${totalMetas} no ritmo esperado` : 'Nenhuma missão criada ainda'}
        />

        {/* A nota da NOVA aqui é o texto exato do protótipo (fala de
            "amanhã", não de hoje) — mantida como placeholder estático, não
            gerada a partir de `todayEvents`. Detectar conflitos reais de
            agenda a partir da data real existe (ver `app/(dashboard)/agenda/page.tsx`),
            mas decidir QUANDO esse alerta específico "vale a pena" aparecer
            é a lógica que o HANDOFF marca como fora de escopo desta
            implementação. */}
        <DataCard
          label="AGENDA DE HOJE"
          listRows={
            todayEvents.length > 0
              ? todayEvents.map((event) => ({ label: event.title, value: event.time ?? '' }))
              : undefined
          }
          description={todayEvents.length === 0 ? 'Nenhum compromisso hoje' : undefined}
          novaNote="Duas reuniões amanhã sem intervalo. Posso reorganizar?"
        />

        <DataCard label="CRM" value="6 clientes" description="1 follow-up pendente hoje" />

        <DataCard
          label="DOCUMENTOS"
          value={String(documents.length)}
          description={documents.length > 0 ? '3 aguardando revisão' : 'Nenhum documento ainda'}
        />

        <DataCard label="AUTOMAÇÕES" value="9 ativas" description="Todas operando normalmente" />
      </div>
    </div>
  );
}
