'use client';

import * as React from 'react';
import { Check, NotebookText, Pin } from 'lucide-react';
import { Input } from '@control-os/ui';
import { FadeIn } from '@/components/dashboard/fade-in';
import { GlassCard } from '@/components/ui/glass-card';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/dashboard/section-header';
import { RecommendationCard } from '@/components/dashboard/recommendation-card';
import { useDataStore } from '@/lib/data-store';
import { cn } from '@/lib/utils';
import type { Note } from '@control-os/types';

const RECENT_COUNT = 3;

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(date));
}

/**
 * Notas — módulo premium (CONTROL OS — Etapa 10B).
 *
 * "Fixadas" é estado local efêmero (mesmo padrão de Documentos) — o tipo
 * `Note` não tem campo de destaque, e criar um exigiria persistência nova,
 * fora do escopo visual desta etapa. "Preview" trunca o conteúdo da nota de
 * texto (`line-clamp`) em vez de mostrar tudo sempre — só CSS, mesmo dado.
 */
export default function NotasPage() {
  const notes = useDataStore((state) => state.notes);
  const toggleNoteChecklistItem = useDataStore((state) => state.toggleNoteChecklistItem);
  const [query, setQuery] = React.useState('');
  const [pinnedIds, setPinnedIds] = React.useState<string[]>([]);

  const togglePinned = (id: string) => {
    setPinnedIds((current) => (current.includes(id) ? current.filter((pinnedId) => pinnedId !== id) : [...current, id]));
  };

  const filtered = notes.filter((note) => {
    const haystack = `${note.title} ${note.content ?? ''}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const pinned = filtered.filter((note) => pinnedIds.includes(note.id));
  const recent = [...filtered]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, RECENT_COUNT);
  const categories = Array.from(new Set(filtered.map((note) => note.category)));

  // "NOVA comentando" (CONTROL OS — Etapa 11): mesmo padrão do resumo em
  // Financeiro/Agenda/Hábitos — texto local a partir de TODAS as notas (não
  // só `filtered`), contando itens de checklist ainda pendentes.
  const pendingChecklistCount = notes.reduce(
    (sum, note) => sum + (note.checklistItems?.filter((item) => !item.done).length ?? 0),
    0
  );
  const resumoNova =
    notes.length === 0
      ? 'Ainda não há notas para eu montar um resumo.'
      : pendingChecklistCount > 0
        ? `Você tem ${notes.length} nota${notes.length > 1 ? 's' : ''}, com ${pendingChecklistCount} item${pendingChecklistCount > 1 ? 'ns' : ''} de checklist ainda pendente${pendingChecklistCount > 1 ? 's' : ''}.`
        : `Você tem ${notes.length} nota${notes.length > 1 ? 's' : ''} guardada${notes.length > 1 ? 's' : ''}.`;

  function renderNoteCard(note: Note) {
    const isPinned = pinnedIds.includes(note.id);
    return (
      <GlassCard key={note.id} interactive={false} className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-tint/[0.06] text-text-secondary">
            <NotebookText className="h-4 w-4" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-text-primary">{note.title}</p>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-text-tertiary">{formatDate(note.createdAt)}</span>
                <button
                  onClick={() => togglePinned(note.id)}
                  aria-label={isPinned ? 'Desafixar' : 'Fixar'}
                  className="rounded-md p-1 text-text-tertiary transition-colors duration-fast ease-out hover:bg-tint/[0.06] hover:text-text-primary"
                >
                  <Pin className={cn('h-3.5 w-3.5', isPinned && 'fill-accent-purple text-accent-purple')} />
                </button>
              </div>
            </div>

            {note.type === 'texto' && note.content && (
              <p className="line-clamp-2 text-xs text-text-secondary">{note.content}</p>
            )}

            {note.type === 'checklist' && note.checklistItems && (
              <div className="mt-1 flex flex-col gap-1">
                {note.checklistItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggleNoteChecklistItem(note.id, item.id)}
                    className="flex items-center gap-2 rounded px-1 py-1 text-left text-xs transition-colors duration-fast ease-out hover:bg-tint/[0.04]"
                  >
                    <span
                      className={cn(
                        'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                        item.done ? 'border-accent-green bg-accent-green/20' : 'border-tint/20'
                      )}
                    >
                      {item.done && <Check className="h-2.5 w-2.5 text-accent-green" />}
                    </span>
                    <span className={item.done ? 'text-text-tertiary line-through' : 'text-text-secondary'}>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <SectionHeader level="page" title="Notas" meta={`${notes.length} no total`} />
      </FadeIn>

      {notes.length > 0 && (
        <FadeIn delay={0.04}>
          <RecommendationCard text={resumoNova} />
        </FadeIn>
      )}

      <FadeIn delay={0.05}>
        <Input placeholder="Buscar notas..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </FadeIn>

      {filtered.length === 0 && (
        <FadeIn delay={0.1}>
          <EmptyState
            icon={NotebookText}
            title={notes.length === 0 ? 'Nenhuma nota ainda.' : 'Nenhuma nota encontrada para essa busca.'}
          />
        </FadeIn>
      )}

      {pinned.length > 0 && (
        <FadeIn delay={0.08}>
          <div className="flex flex-col gap-3">
            <SectionHeader title="Fixadas" meta={`${pinned.length}`} />
            <div className="flex flex-col gap-2">{pinned.map((note) => renderNoteCard(note))}</div>
          </div>
        </FadeIn>
      )}

      {recent.length > 0 && (
        <FadeIn delay={0.1}>
          <div className="flex flex-col gap-3">
            <SectionHeader title="Recentes" />
            <div className="flex flex-col gap-2">{recent.map((note) => renderNoteCard(note))}</div>
          </div>
        </FadeIn>
      )}

      {categories.map((category, categoryIndex) => (
        <FadeIn key={category} delay={0.05 * (categoryIndex + 3)}>
          <div className="flex flex-col gap-3">
            <SectionHeader title={category} />
            <div className="flex flex-col gap-2">
              {filtered.filter((note) => note.category === category).map((note) => renderNoteCard(note))}
            </div>
          </div>
        </FadeIn>
      ))}
    </div>
  );
}
