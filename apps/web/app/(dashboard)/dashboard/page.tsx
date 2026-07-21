'use client';

import * as React from 'react';
import { AgentWidgetCard } from '@/components/dashboard/agent-widget-card';
import { DataCard } from '@/components/dashboard/data-card';
import { MiniBarChart, MiniSparkline, type ChartAccent } from '@/components/dashboard/mini-charts';
import { useDataStore } from '@/lib/data-store';
import { financeEntrySign, formatCurrency } from '@/lib/utils';
import { toLocalDateString } from '@/services/nova';

/**
 * Dashboard / "Visão geral" — Home oficial do CONTROL OS.
 *
 * Reorganização "pessoa física" (pedido explícito do usuário, sobre a Home
 * já existente): a área da NOVA (`AgentWidgetCard` — toggle, esfera, campo
 * de comando, atalhos) é INTOCADA, exatamente como estava, sempre a
 * primeira linha da grade. Tudo abaixo dela foi reorganizado.
 *
 * "Projetos", "CRM", "Documentos" e "Automações" saíram da Visão Geral —
 * continuam existindo como módulos próprios na Sidebar, só não fazem mais
 * parte da Home. Os quatro pilares da rotina de uma pessoa física —
 * Financeiro, Agenda, Metas, Hábitos — agora são a PRIMEIRA linha depois da
 * NOVA (maior destaque, ocupam sozinhos a grade de 4 colunas). Hábitos é
 * novo aqui: a Home nunca teve um card desse módulo antes.
 *
 * Abaixo dos quatro pilares, uma segunda grade traz informação
 * complementar de cada um — 3 cards por pilar (Financeiro/Hábitos) ou menos
 * (Agenda/Metas), na mesma ordem dos pilares acima, sem cabeçalhos de seção
 * (cada `DataCard` já se explica pelo próprio label). Nenhum dado novo é
 * inventado: cada card usa exatamente a mesma fórmula/fonte que o módulo
 * completo correspondente (`/financeiro`, `/agenda`, `/metas`, `/habitos`)
 * já usa — só reapresentado em formato resumido aqui.
 */

const CURRENT_MONTH_PREFIX = () => toLocalDateString(new Date()).slice(0, 7);
const PREVIOUS_MONTH_PREFIX = () => {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return toLocalDateString(prevMonth).slice(0, 7);
};

/** Mesmo formato usado em `agenda/page.tsx` e `metas/page.tsx` para datas curtas ("24 jul"). */
function formatShortDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${dateStr}T00:00:00`));
}

/** Mesma fórmula de `habitos/page.tsx`: % de dias concluídos nos últimos 7. */
function successRate(last7Days: boolean[]): number {
  if (last7Days.length === 0) return 0;
  return (last7Days.filter(Boolean).length / last7Days.length) * 100;
}

const CHART_ACCENTS: readonly ChartAccent[] = ['purple', 'blue', 'green', 'red'];

export default function DashboardPage() {
  const financeEntries = useDataStore((s) => s.financeEntries);
  const missions = useDataStore((s) => s.missions);
  const agendaEvents = useDataStore((s) => s.agendaEvents);
  const debts = useDataStore((s) => s.debts);
  const habits = useDataStore((s) => s.habits);

  // Financeiro (pilar) — real: faturamento do mês corrente + variação vs. mês
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

  // Financeiro (complementar) — saldo acumulado + fluxo de caixa, mesma
  // fórmula de `financeiro/page.tsx` (soma corrida cronológica).
  const { saldo, flowValues } = React.useMemo(() => {
    const chronological = [...financeEntries].sort((a, b) => a.date.localeCompare(b.date));
    const values: number[] = [];
    let running = 0;
    for (const entry of chronological) {
      running += financeEntrySign(entry) * entry.amount;
      values.push(running);
    }
    return { saldo: running, flowValues: values };
  }, [financeEntries]);

  const gastosRecentes = React.useMemo(
    () =>
      [...financeEntries]
        .filter((entry) => entry.type === 'despesa')
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 4),
    [financeEntries]
  );

  const { openDebts, parcelamentosTop } = React.useMemo(() => {
    const open = debts.filter((debt) => debt.installmentsPaid < debt.installmentsTotal);
    const top = [...open].sort((a, b) => b.remainingAmount - a.remainingAmount).slice(0, 4);
    return { openDebts: open, parcelamentosTop: top };
  }, [debts]);
  const totalDividasAbertas = React.useMemo(
    () => openDebts.reduce((sum, debt) => sum + debt.remainingAmount, 0),
    [openDebts]
  );

  // Agenda (pilar) — real, mesmo critério de "hoje" do módulo Agenda
  // (`toLocalDateString`, nunca `toISOString` — bug de fuso já corrigido).
  const todayEvents = React.useMemo(() => {
    const todayIso = toLocalDateString(new Date());
    return agendaEvents
      .filter((event) => event.date === todayIso)
      .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
  }, [agendaEvents]);

  // Agenda (complementar) — próximos eventos depois de hoje.
  const proximosEventos = React.useMemo(() => {
    const todayIso = toLocalDateString(new Date());
    return agendaEvents
      .filter((event) => event.date > todayIso)
      .sort((a, b) => `${a.date}T${a.time ?? '00:00'}`.localeCompare(`${b.date}T${b.time ?? '00:00'}`))
      .slice(0, 4);
  }, [agendaEvents]);

  // Metas (pilar) — real: progresso médio das missões + quantas estão "no
  // ritmo" (todo status que não seja `em_risco`).
  const { progressoMedio, noRitmo, totalMetas } = React.useMemo(() => {
    const total = missions.length;
    const avg = total > 0 ? Math.round(missions.reduce((sum, m) => sum + m.progress, 0) / total) : 0;
    const onTrack = missions.filter((m) => m.status !== 'em_risco').length;
    return { progressoMedio: avg, noRitmo: onTrack, totalMetas: total };
  }, [missions]);

  // Metas (complementar) — mesmo recorte de `metas/page.tsx` (`kind === 'meta'`).
  const metas = React.useMemo(() => missions.filter((m) => m.kind === 'meta'), [missions]);
  const metasBreakdown = React.useMemo(() => {
    const concluidas = metas.filter((m) => m.status === 'concluida').length;
    const emRisco = metas.filter((m) => m.status === 'em_risco').length;
    return { concluidas, emRisco, emAndamento: metas.length - concluidas - emRisco };
  }, [metas]);
  const proximosObjetivos = React.useMemo(
    () =>
      metas
        .filter((m) => m.dueDate && m.status !== 'concluida')
        .sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string))
        .slice(0, 3),
    [metas]
  );

  // Hábitos (pilar + complementar) — mesmas fórmulas de `habitos/page.tsx`.
  const habitsCompletedToday = React.useMemo(() => habits.filter((h) => h.completedToday).length, [habits]);
  const habitsPendentes = React.useMemo(() => habits.filter((h) => !h.completedToday), [habits]);
  const { longestStreak, longestStreakHabit } = React.useMemo(() => {
    const max = habits.reduce((acc, h) => Math.max(acc, h.streakDays), 0);
    return { longestStreak: max, longestStreakHabit: habits.find((h) => h.streakDays === max) };
  }, [habits]);
  const averageSuccessRate = React.useMemo(() => {
    if (habits.length === 0) return 0;
    return habits.reduce((sum, h) => sum + successRate(h.last7Days), 0) / habits.length;
  }, [habits]);
  const habitBarData = React.useMemo(
    () =>
      habits.slice(0, 5).map((habit, index) => ({
        label: habit.title,
        value: successRate(habit.last7Days),
        displayValue: `${Math.round(successRate(habit.last7Days))}%`,
        accent: CHART_ACCENTS[index % CHART_ACCENTS.length],
      })),
    [habits]
  );

  return (
    <div className="flex flex-col gap-3.5 px-6 py-6 sm:px-8">
      {/* NOVA — intocada, sempre a primeira linha. */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-4">
          <AgentWidgetCard />
        </div>

        {/* Os quatro pilares da rotina — maior destaque, primeira linha da grade. */}
        <DataCard label="FINANCEIRO" value={formatCurrency(faturamentoMes)} description={tendenciaLabel} />

        <DataCard
          label="AGENDA DE HOJE"
          listRows={
            todayEvents.length > 0
              ? todayEvents.map((event) => ({ label: event.title, value: event.time ?? '' }))
              : undefined
          }
          description={todayEvents.length === 0 ? 'Nenhum compromisso hoje' : undefined}
        />

        <DataCard
          label="METAS"
          value={totalMetas > 0 ? `${progressoMedio}%` : '—'}
          description={totalMetas > 0 ? `${noRitmo} de ${totalMetas} no ritmo esperado` : 'Nenhuma missão criada ainda'}
        />

        <DataCard
          label="HÁBITOS"
          value={habits.length > 0 ? `${habitsCompletedToday}/${habits.length}` : '—'}
          description={
            habits.length === 0
              ? 'Nenhum hábito criado ainda'
              : habitsPendentes.length === 0
                ? 'Todos concluídos hoje'
                : `${habitsPendentes.length} pendente${habitsPendentes.length > 1 ? 's' : ''} hoje`
          }
        />
      </div>

      {/* Informação complementar dos quatro pilares — mesma ordem acima. */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        <DataCard
          label="PARCELAMENTOS"
          value={openDebts.length > 0 ? formatCurrency(totalDividasAbertas) : undefined}
          description={openDebts.length > 0 ? `${openDebts.length} conta${openDebts.length > 1 ? 's' : ''} em aberto` : 'Nenhuma parcela em aberto'}
          listRows={parcelamentosTop.map((debt) => ({
            label: debt.description,
            value: `${debt.installmentsPaid}/${debt.installmentsTotal}`,
          }))}
        />

        <DataCard label="FLUXO DE CAIXA" value={formatCurrency(saldo)} description="Saldo acumulado do período">
          <MiniSparkline values={flowValues} accent={saldo >= 0 ? 'green' : 'red'} />
        </DataCard>

        <DataCard
          label="GASTOS RECENTES"
          description={gastosRecentes.length === 0 ? 'Nenhuma despesa registrada' : undefined}
          listRows={gastosRecentes.map((entry) => ({
            label: entry.description,
            value: `-${formatCurrency(entry.amount)}`,
          }))}
        />

        <DataCard
          label="PRÓXIMOS EVENTOS"
          description={proximosEventos.length === 0 ? 'Nenhum evento nos próximos dias' : undefined}
          listRows={proximosEventos.map((event) => ({
            label: event.title,
            value: `${formatShortDate(event.date)}${event.time ? ` · ${event.time}` : ''}`,
          }))}
        />

        <DataCard
          label="PROGRESSO DAS METAS"
          description={metas.length === 0 ? 'Nenhuma meta criada ainda' : undefined}
          listRows={
            metas.length > 0
              ? [
                  { label: 'Concluídas', value: String(metasBreakdown.concluidas) },
                  { label: 'Em risco', value: String(metasBreakdown.emRisco) },
                  { label: 'Em andamento', value: String(metasBreakdown.emAndamento) },
                ]
              : undefined
          }
        />

        <DataCard
          label="OBJETIVOS MAIS PRÓXIMOS"
          description={proximosObjetivos.length === 0 ? 'Nenhum objetivo com prazo definido' : undefined}
          listRows={proximosObjetivos.map((meta) => ({
            label: meta.title,
            value: `${formatShortDate(meta.dueDate as string)} · ${meta.progress}%`,
          }))}
        />

        <DataCard
          label="HÁBITOS PENDENTES"
          description={habits.length === 0 ? 'Nenhum hábito criado ainda' : habitsPendentes.length === 0 ? 'Todos os hábitos concluídos hoje' : undefined}
          listRows={habitsPendentes.map((habit) => ({ label: habit.title, value: habit.category }))}
        />

        <DataCard
          label="SEQUÊNCIA ATUAL"
          value={habits.length > 0 ? `${longestStreak} dias` : '—'}
          description={longestStreakHabit ? longestStreakHabit.title : 'Nenhum hábito criado ainda'}
        />

        <DataCard
          label="EVOLUÇÃO DA SEMANA"
          value={habits.length > 0 ? `${Math.round(averageSuccessRate)}%` : '—'}
          description="Taxa de sucesso nos últimos 7 dias"
        >
          {habitBarData.length > 0 && <MiniBarChart data={habitBarData} />}
        </DataCard>
      </div>
    </div>
  );
}
