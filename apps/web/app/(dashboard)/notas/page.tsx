'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { Input } from '@control-os/ui';
import { FadeIn } from '@/components/dashboard/fade-in';
import { GlassCard } from '@/components/ui/glass-card';
import { ICON_MAP } from '@/components/layout/icon-map';
import { useDataStore } from '@/lib/data-store';
import { cn } from '@/lib/utils';

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(date));
}

/**
 * Notas — módulo pessoal (CONTROL OS — Sistema Operacional Pessoal).
 *
 * Dois tipos por nota (`texto` e `checklist`), busca por título/conteúdo e
 * agrupamento por categoria — os 3 pontos pedidos na spec, sem exigir
 * "imagens" nesta fase (não há storage real de arquivo ainda; ver
 * Documentos, mesma limitação, mesma justificativa).
 */
export default function NotasPage() {
  const notes = useDataStore((state) => state.notes);
  const toggleNoteChecklistItem = useDataStore((state) => state.toggleNoteChecklistItem);
  const [query, setQuery] = React.useState('');

  const filtered = notes.filter((note) => {
    const haystack = `${note.title} ${note.content ?? ''}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const categories = Array.from(new Set(filtered.map((note) => note.category)));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text-primary">Notas</h1>
          <span className="text-xs text-text-tertiary">{notes.length} no total</span>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Input
          placeholder="Buscar notas..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </FadeIn>

      {filtered.length === 0 && (
        <FadeIn delay={0.1}>
          <GlassCard interactive={false} className="p-8 text-center text-sm text-text-secondary">
            {notes.length === 0 ? 'Nenhuma nota ainda.' : 'Nenhuma nota encontrada para essa busca.'}
          </GlassCard>
        </FadeIn>
      )}

      {categories.map((category, categoryIndex) => (
        <FadeIn key={category} delay={0.05 * (categoryIndex + 1)}>
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-text-primary">{category}</h2>
            <div className="flex flex-col gap-2">
              {filtered
                .filter((note) => note.category === category)
                .map((note) => (
                  <GlassCard key={note.id} interactive={false} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-text-secondary">
                        <ICON_MAP.NotebookText className="h-4 w-4" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm text-text-primary">{note.title}</p>
                          <span className="shrink-0 text-xs text-text-tertiary">{formatDate(note.createdAt)}</span>
                        </div>

                        {note.type === 'texto' && note.content && (
                          <p className="text-xs text-text-secondary">{note.content}</p>
                        )}

                        {note.type === 'checklist' && note.checklistItems && (
                          <div className="mt-1 flex flex-col gap-1">
                            {note.checklistItems.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => toggleNoteChecklistItem(note.id, item.id)}
                                className="flex items-center gap-2 rounded px-1 py-1 text-left text-xs transition-colors duration-fast ease-out hover:bg-white/[0.04]"
                              >
                                <span
                                  className={cn(
                                    'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                                    item.done ? 'border-accent-green bg-accent-green/20' : 'border-white/20'
                                  )}
                                >
                                  {item.done && <Check className="h-2.5 w-2.5 text-accent-green" />}
                                </span>
                                <span className={item.done ? 'text-text-tertiary line-through' : 'text-text-secondary'}>
                                  {item.label}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                ))}
            </div>
          </div>
        </FadeIn>
      ))}
    </div>
  );
}
