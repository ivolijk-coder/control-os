'use client';

import { Flag, ListChecks, Trophy } from 'lucide-react';
import { Progress } from '@control-os/ui';
import { FadeIn } from '@/components/dashboard/fade-in';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/dashboard/section-header';
import { DashboardCard } from '@/components/dashboard/dashboard-card';
import { ChartCard } from '@/components/dashboard/chart-card';
import { TimelineCard, type TimelineCardItem } from '@/components/dashboard/timeline-card';
import { MissionStatusBadge } from '@/components/dashboard/status-badge';
import { useDataStore } from '@/lib/data-store';

function daysRemaining(dueDate?: string): number | null {
  if (!dueDate) return null;
  return Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/**
 * "Chance de concluir" — rótulo qualitativo derivado só do `progress` que já
 * existe (0–100). Não é uma previsão estatística real (não há data de
 * início da Missão pra calcular ritmo) — é uma categorização transparente
 * em 3 faixas, deixada clara como heurística simples, não como IA.
 */
function completionChance(progress: number, status: string): { label: string; tone: 'green' | 'blue' | 'red' } {
  if (status === 'concluida') return { label: 'Concluída', tone: 'green' };
  if (status === 'em_risco') return { label: 'Em risco', tone: 'red' };
  if (progress >= 70) return { label: 'Alta', tone: 'green' };
  if (progress >= 40) return { label: 'Média', tone: 'blue' };
  return { label: 'Baixa', tone: 'red' };
}

function formatDueDate(dueDate?: string): string | null {
  if (!dueDate) return null;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(dueDate));
}

/**
 * Metas — módulo premium (CONTROL OS — Etapa 10B).
 *
 * Continua sendo `Mission` filtrada por `kind === 'meta'` (mesma fonte de
 * Missões, sem tipo `Goal` novo). "Subobjetivos" aparece como progresso de
 * objetivos (`objectivesDone`/`objectivesTotal`) — o dado real já tem essa
 * contagem; não invento títulos de subobjetivo que não existem no modelo.
 */
export default function MetasPage() {
  const missions = useDataStore((state) => state.missions);
  const metas = missions.filter((mission) => mission.kind === 'meta');

  const concluidas = metas.filter((meta) => meta.status === 'concluida').length;
  const emRisco = metas.filter((meta) => meta.status === 'em_risco').length;
  const progressoMedio = metas.length > 0 ? metas.reduce((sum, meta) => sum + meta.progress, 0) / metas.length : 0;

  const roadmapItems: TimelineCardItem[] = [...metas]
    .filter((meta) => meta.dueDate)
    .sort((a, b) => new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime())
    .map((meta) => ({
      id: meta.id,
      icon: Flag,
      title: meta.title,
      meta: `${formatDueDate(meta.dueDate)} · ${meta.progress}% concluído`,
      done: meta.status === 'concluida',
      accent: meta.status === 'em_risco' ? 'red' : meta.status === 'concluida' ? 'green' : 'purple',
    }));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <SectionHeader level="page" title="Metas" meta={`${metas.length} no total`} />
      </FadeIn>

      {metas.length === 0 ? (
        <FadeIn delay={0.05}>
          <EmptyState
            icon={Trophy}
            title="Nenhuma meta ainda."
            description='Conte para a Nova, ex.: "Quero economizar R$ 500" ou "Minha meta é ler 12 livros".'
          />
        </FadeIn>
      ) : (
        <>
          <FadeIn delay={0.05}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <DashboardCard icon={Trophy} label="Concluídas" value={`${concluidas}/${metas.length}`} accent="green" />
              <DashboardCard icon={Flag} label="Em risco" value={`${emRisco}`} accent={emRisco > 0 ? 'red' : 'green'} />
              <DashboardCard icon={ListChecks} label="Progresso médio" value={`${Math.round(progressoMedio)}%`} accent="purple" />
            </div>
          </FadeIn>

          <FadeIn delay={0.08}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {metas.map((meta) => {
                const chance = completionChance(meta.progress, meta.status);
                const restante = daysRemaining(meta.dueDate);
                return (
                  <div
                    key={meta.id}
                    className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-card/60 p-4 shadow-e3 backdrop-blur-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium leading-snug text-text-primary">{meta.title}</p>
                      <MissionStatusBadge status={meta.status} />
                    </div>

                    <div className="flex items-center gap-3">
                      <Progress value={meta.progress} className="flex-1" />
                      <span className="font-mono text-xs text-text-secondary">{meta.progress}%</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-tertiary">
                      <span>
                        {meta.objectivesDone}/{meta.objectivesTotal} objetivos
                      </span>
                      {restante !== null && (
                        <span>{restante >= 0 ? `${restante}d restantes` : `${Math.abs(restante)}d em atraso`}</span>
                      )}
                      <span className={chance.tone === 'green' ? 'text-accent-green' : chance.tone === 'red' ? 'text-accent-red' : 'text-accent-blue'}>
                        Chance de concluir: {chance.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </FadeIn>

          {roadmapItems.length > 0 && (
            <FadeIn delay={0.12}>
              <ChartCard title="Roadmap" description="Metas ordenadas pelo prazo">
                <TimelineCard items={roadmapItems} />
              </ChartCard>
            </FadeIn>
          )}
        </>
      )}
    </div>
  );
}
