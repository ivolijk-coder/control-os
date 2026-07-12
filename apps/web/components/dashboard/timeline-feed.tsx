import { Activity, Bot, CalendarClock, CheckCircle2, FileText, Wallet } from 'lucide-react';
import { Card } from '@control-os/ui';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { TimelineEvent, TimelineEventType } from '@control-os/types';

const TYPE_ICON: Record<TimelineEventType, typeof Activity> = {
  missao_criada: Activity,
  missao_concluida: CheckCircle2,
  execucao: Activity,
  mensagem_nova: Bot,
  documento: FileText,
  financeiro: Wallet,
  agenda_criada: CalendarClock,
  sistema: Activity,
};

const ACTOR_LABEL: Record<TimelineEvent['actor'], string> = {
  user: 'Você',
  nova: 'Nova',
  sistema: 'Sistema',
};

const ACTOR_CLASSES: Record<TimelineEvent['actor'], string> = {
  user: 'bg-accent-blue/15 text-accent-blue',
  nova: 'bg-accent-purple/15 text-accent-purple',
  sistema: 'bg-white/[0.08] text-text-secondary',
};

/** Prévia da Timeline Inteligente (Control Feed™) exibida no Dashboard Vivo™. */
export function TimelineFeed({ events }: { events: TimelineEvent[] }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-text-primary">Timeline Inteligente</h2>
        <span className="text-xs text-text-tertiary">Últimas atividades</span>
      </div>

      <ul className="flex flex-col gap-4">
        {events.map((event) => {
          const Icon = TYPE_ICON[event.type];
          return (
            <li key={event.id} className="flex gap-3">
              <span
                className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                  ACTOR_CLASSES[event.actor]
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-text-primary">{event.title}</p>
                {event.description && (
                  <p className="mt-0.5 text-xs leading-snug text-text-secondary">{event.description}</p>
                )}
                <div className="mt-1 flex items-center gap-2 text-[11px] text-text-tertiary">
                  <span>{ACTOR_LABEL[event.actor]}</span>
                  <span>·</span>
                  <span>{formatRelativeTime(new Date(event.timestamp))}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
