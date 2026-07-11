import { Badge, Card, Progress } from '@control-os/ui';
import type { Mission, MissionStatus } from '@control-os/types';

const STATUS_LABEL: Record<MissionStatus, string> = {
  planejamento: 'Planejamento',
  em_andamento: 'Em andamento',
  em_risco: 'Em risco',
  concluida: 'Concluída',
};

const STATUS_VARIANT: Record<MissionStatus, 'neutral' | 'green' | 'blue' | 'purple' | 'red'> = {
  planejamento: 'neutral',
  em_andamento: 'blue',
  em_risco: 'red',
  concluida: 'green',
};

function formatDueDate(dueDate?: string): string | null {
  if (!dueDate) return null;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(dueDate));
}

export function MissionCard({ mission }: { mission: Mission }) {
  const dueLabel = formatDueDate(mission.dueDate);

  return (
    <Card className="p-4 transition-colors duration-fast ease-out hover:border-white/20">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-snug text-text-primary">{mission.title}</p>
        <Badge variant={STATUS_VARIANT[mission.status]}>{STATUS_LABEL[mission.status]}</Badge>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Progress value={mission.progress} className="flex-1" />
        <span className="font-mono text-xs text-text-secondary">{mission.progress}%</span>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-text-tertiary">
        <span>
          {mission.objectivesDone}/{mission.objectivesTotal} objetivos
        </span>
        {dueLabel && <span>Prazo: {dueLabel}</span>}
      </div>
    </Card>
  );
}
