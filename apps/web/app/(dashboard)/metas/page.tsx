'use client';

import { FadeIn } from '@/components/dashboard/fade-in';
import { MissionCard } from '@/components/dashboard/mission-card';
import { GlassCard } from '@/components/ui/glass-card';
import { useDataStore } from '@/lib/data-store';

/**
 * Metas — módulo pessoal (CONTROL OS — Sistema Operacional Pessoal).
 *
 * Reaproveita Missão (`kind === 'meta'`) em vez de criar um tipo `Goal`
 * separado — mesma fonte de dados que Missões, só filtrada: aqui só entra o
 * que a Nova classificou como objetivo/meta (ex.: "Quero economizar R$
 * 500", "Meu objetivo é..."), não lembretes nem projetos. `MissionCard` é o
 * mesmo componente da tela de Missões — progresso/prazo já vêm prontos.
 */
export default function MetasPage() {
  const missions = useDataStore((state) => state.missions);
  const metas = missions.filter((mission) => mission.kind === 'meta');

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text-primary">Metas</h1>
          <span className="text-xs text-text-tertiary">{metas.length} no total</span>
        </div>
      </FadeIn>

      {metas.length === 0 && (
        <FadeIn delay={0.05}>
          <GlassCard interactive={false} className="p-8 text-center text-sm text-text-secondary">
            Nenhuma meta ainda. Conte para a Nova, ex.: &quot;Quero economizar R$ 500&quot; ou &quot;Minha meta é ler 12 livros&quot;.
          </GlassCard>
        </FadeIn>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {metas.map((mission, index) => (
          <FadeIn key={mission.id} delay={0.05 * index}>
            <MissionCard mission={mission} />
          </FadeIn>
        ))}
      </div>
    </div>
  );
}
