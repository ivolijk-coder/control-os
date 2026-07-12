'use client';

import type { MissionStatus } from '@control-os/types';
import { FadeIn } from '@/components/dashboard/fade-in';
import { MissionCard } from '@/components/dashboard/mission-card';
import { GlassCard } from '@/components/ui/glass-card';
import { useDataStore } from '@/lib/data-store';

const STATUS_ORDER: MissionStatus[] = ['em_risco', 'em_andamento', 'planejamento', 'concluida'];

const STATUS_LABEL: Record<MissionStatus, string> = {
  planejamento: 'Planejamento',
  em_andamento: 'Em andamento',
  em_risco: 'Em risco',
  concluida: 'Concluída',
};

/**
 * Missões — módulo completo (CONTROL OS 3.0).
 *
 * Lê de `useDataStore`: toda missão criada por conversa com a Nova (ex.:
 * "Lembrar de pagar o DAS", "Quero faturar R$ 500 mil", "Vou viajar em
 * novembro") aparece aqui automaticamente, agrupada por status — mesma
 * fonte de dados que o Dashboard e a conversa usam, sem duplicação.
 */
export default function MissoesPage() {
  const missions = useDataStore((state) => state.missions);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text-primary">Missões</h1>
          <span className="text-xs text-text-tertiary">{missions.length} no total</span>
        </div>
      </FadeIn>

      {missions.length === 0 && (
        <FadeIn delay={0.05}>
          <GlassCard interactive={false} className="p-8 text-center text-sm text-text-secondary">
            Nenhuma missão ainda. Conte para a Nova o que você precisa lembrar, alcançar ou organizar.
          </GlassCard>
        </FadeIn>
      )}

      {STATUS_ORDER.map((status, index) => {
        const missionsInStatus = missions.filter((mission) => mission.status === status);
        if (missionsInStatus.length === 0) return null;

        return (
          <FadeIn key={status} delay={0.05 * (index + 1)}>
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-text-primary">{STATUS_LABEL[status]}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {missionsInStatus.map((mission) => (
                  <MissionCard key={mission.id} mission={mission} />
                ))}
              </div>
            </div>
          </FadeIn>
        );
      })}
    </div>
  );
}
