'use client';

import { AlertTriangle, CalendarCheck, CheckCircle2, ListChecks, TrendingUp } from 'lucide-react';
import { FadeIn } from '@/components/dashboard/fade-in';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/dashboard/section-header';
import { DashboardCard } from '@/components/dashboard/dashboard-card';
import { MissionCard } from '@/components/dashboard/mission-card';
import { ChartCard } from '@/components/dashboard/chart-card';
import { RecommendationCard } from '@/components/dashboard/recommendation-card';
import { useDataStore } from '@/lib/data-store';
import type { Mission } from '@control-os/types';

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function MissionColumn({ title, missions, emptyLabel }: { title: string; missions: Mission[]; emptyLabel: string }) {
  return (
    <div className="flex flex-col gap-3">
      <SectionHeader title={title} meta={`${missions.length}`} />
      {missions.length === 0 ? (
        <p className="text-xs text-text-tertiary">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {missions.map((mission) => (
            <MissionCard key={mission.id} mission={mission} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Missões — painel de produtividade premium (CONTROL OS — Etapa 10B).
 *
 * Continua lendo só `useDataStore.missions` — nenhum campo novo. Não existe
 * "prioridade"/"impacto" no tipo `Mission`; em vez de inventar campos, uso
 * "em risco + prazo próximo" como proxy real de prioridade (derivado, não
 * persistido) e `objectivesTotal` (quantos objetivos a missão tem) como
 * proxy honesto de "impacto" — maior escopo real, não uma nota fabricada.
 */
export default function MissoesPage() {
  const missions = useDataStore((state) => state.missions);
  const today = isoToday();

  const emRisco = missions.filter((mission) => mission.status === 'em_risco');
  const hoje = missions.filter((mission) => mission.dueDate === today && mission.status !== 'concluida');
  const emAndamento = missions.filter((mission) => mission.status === 'em_andamento');
  const concluidas = missions.filter((mission) => mission.status === 'concluida');
  const planejamento = missions.filter((mission) => mission.status === 'planejamento');

  const maiorImpacto = [...missions]
    .filter((mission) => mission.status !== 'concluida')
    .sort((a, b) => b.objectivesTotal - a.objectivesTotal)
    .slice(0, 3);

  // "NOVA comentando" (CONTROL OS — Etapa 11): mesmo padrão do resumo em
  // Financeiro/Agenda/Hábitos — texto local, sem chamar IA.
  const resumoNova =
    missions.length === 0
      ? 'Ainda não há missões suficientes para eu montar um resumo.'
      : emRisco.length > 0
        ? `${emRisco.length} missão${emRisco.length > 1 ? 'ões' : ''} em risco de prazo. ${hoje.length > 0 ? `${hoje.length} com prazo para hoje.` : ''}`.trim()
        : hoje.length > 0
          ? `${hoje.length} missão${hoje.length > 1 ? 'ões' : ''} com prazo para hoje. ${emAndamento.length} em andamento no total.`
          : `${emAndamento.length} missão${emAndamento.length === 1 ? '' : 'ões'} em andamento, nenhuma em risco.`;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <SectionHeader level="page" title="Missões" meta={`${missions.length} no total`} />
      </FadeIn>

      {missions.length === 0 ? (
        <FadeIn delay={0.05}>
          <EmptyState
            icon={ListChecks}
            title="Nenhuma missão ainda."
            description="Conte para a Nova o que você precisa lembrar, alcançar ou organizar."
          />
        </FadeIn>
      ) : (
        <>
          <FadeIn delay={0.05}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DashboardCard icon={AlertTriangle} label="Em risco" value={`${emRisco.length}`} accent={emRisco.length > 0 ? 'red' : 'green'} />
              <DashboardCard icon={CalendarCheck} label="Para hoje" value={`${hoje.length}`} accent="blue" />
              <DashboardCard icon={TrendingUp} label="Em andamento" value={`${emAndamento.length}`} accent="purple" />
              <DashboardCard icon={CheckCircle2} label="Concluídas" value={`${concluidas.length}`} accent="green" />
            </div>
          </FadeIn>

          <FadeIn delay={0.07}>
            <RecommendationCard text={resumoNova} />
          </FadeIn>

          {maiorImpacto.length > 0 && (
            <FadeIn delay={0.08}>
              <ChartCard title="Maior impacto" description="Missões com mais objetivos pela frente">
                <div className="flex flex-col gap-2">
                  {maiorImpacto.map((mission) => (
                    <div key={mission.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-text-primary">{mission.title}</span>
                      <span className="shrink-0 font-mono text-xs text-text-tertiary">
                        {mission.objectivesDone}/{mission.objectivesTotal} objetivos
                      </span>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </FadeIn>
          )}

          <FadeIn delay={0.11}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <MissionColumn title="Em risco" missions={emRisco} emptyLabel="Nenhuma missão em risco. 🎉" />
              <MissionColumn title="Para hoje" missions={hoje} emptyLabel="Nada com prazo para hoje." />
              <MissionColumn title="Em andamento" missions={[...emAndamento, ...planejamento]} emptyLabel="Nenhuma missão em andamento." />
              <MissionColumn title="Concluídas" missions={concluidas} emptyLabel="Nenhuma missão concluída ainda." />
            </div>
          </FadeIn>
        </>
      )}
    </div>
  );
}
