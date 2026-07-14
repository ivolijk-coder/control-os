'use client';

import * as React from 'react';
import { AlertTriangle, FileText, Star } from 'lucide-react';
import { Input } from '@control-os/ui';
import { FadeIn } from '@/components/dashboard/fade-in';
import { GlassCard } from '@/components/ui/glass-card';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/dashboard/section-header';
import { InsightCard } from '@/components/dashboard/insight-card';
import { RecommendationCard } from '@/components/dashboard/recommendation-card';
import { useDataStore } from '@/lib/data-store';
import { cn } from '@/lib/utils';

const EXPIRY_WARNING_DAYS = 90;

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
}

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/**
 * Documentos — módulo premium (CONTROL OS — Etapa 10B).
 *
 * "Favoritos" (`pinnedIds`) é estado local efêmero — não persiste, não
 * entra no `useDataStore`/tipo `PersonalDocument`. Não existe conceito de
 * "favorito" no modelo de dado hoje; adicionar um campo persistido seria
 * criar funcionalidade nova, fora do escopo desta etapa (só visual/UX). Um
 * toggle de sessão dá a experiência pedida sem mexer em arquitetura.
 */
export default function DocumentosPage() {
  const documents = useDataStore((state) => state.documents);
  const [query, setQuery] = React.useState('');
  const [pinnedIds, setPinnedIds] = React.useState<string[]>([]);

  const togglePinned = (id: string) => {
    setPinnedIds((current) => (current.includes(id) ? current.filter((pinnedId) => pinnedId !== id) : [...current, id]));
  };

  const filtered = documents.filter((doc) => doc.title.toLowerCase().includes(query.trim().toLowerCase()));
  const expiring = filtered.filter((doc) => (doc.expiresAt ? daysUntil(doc.expiresAt) <= EXPIRY_WARNING_DAYS : false));
  const pinned = filtered.filter((doc) => pinnedIds.includes(doc.id));
  const categories = Array.from(new Set(filtered.map((doc) => doc.category)));

  // "NOVA comentando" (CONTROL OS — Etapa 11): mesmo padrão do resumo em
  // Financeiro/Agenda/Hábitos — texto local a partir de TODOS os documentos
  // (não só `filtered`, pra não mudar conforme o usuário digita na busca).
  const expiringAll = documents.filter((doc) => (doc.expiresAt ? daysUntil(doc.expiresAt) <= EXPIRY_WARNING_DAYS : false));
  const resumoNova =
    documents.length === 0
      ? 'Ainda não há documentos guardados para eu montar um resumo.'
      : expiringAll.length > 0
        ? `${expiringAll.length} documento${expiringAll.length > 1 ? 's' : ''} vence${expiringAll.length > 1 ? 'm' : ''} nos próximos ${EXPIRY_WARNING_DAYS} dias.`
        : `Você tem ${documents.length} documento${documents.length > 1 ? 's' : ''} guardado${documents.length > 1 ? 's' : ''}, nenhum vencendo em breve.`;

  function renderDocCard(doc: (typeof documents)[number]) {
    const expiringSoon = doc.expiresAt ? daysUntil(doc.expiresAt) <= EXPIRY_WARNING_DAYS : false;
    const isPinned = pinnedIds.includes(doc.id);
    return (
      <GlassCard key={doc.id} interactive={false} className="p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-text-secondary">
            <FileText className="h-4 w-4" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate text-sm text-text-primary">{doc.title}</p>
            <p className="text-xs text-text-tertiary">
              Adicionado em {formatDate(doc.addedAt)}
              {doc.expiresAt ? ` · Válido até ${formatDate(doc.expiresAt)}` : ''}
            </p>
          </div>
          {expiringSoon && (
            <span className="shrink-0 rounded-full border border-accent-red/20 bg-accent-red/10 px-2.5 py-0.5 text-[11px] font-medium text-accent-red">
              Vence em breve
            </span>
          )}
          <button
            onClick={() => togglePinned(doc.id)}
            aria-label={isPinned ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            className="shrink-0 rounded-md p-1.5 text-text-tertiary transition-colors duration-fast ease-out hover:bg-white/[0.06] hover:text-text-primary"
          >
            <Star className={cn('h-4 w-4', isPinned && 'fill-accent-purple text-accent-purple')} />
          </button>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <SectionHeader level="page" title="Documentos" meta={`${documents.length} no total`} />
      </FadeIn>

      {documents.length > 0 && (
        <FadeIn delay={0.04}>
          <RecommendationCard text={resumoNova} />
        </FadeIn>
      )}

      <FadeIn delay={0.05}>
        <Input placeholder="Pesquisar documentos..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </FadeIn>

      {documents.length === 0 && (
        <FadeIn delay={0.08}>
          <EmptyState icon={FileText} title="Nenhum documento ainda." />
        </FadeIn>
      )}

      {documents.length > 0 && filtered.length === 0 && (
        <FadeIn delay={0.08}>
          <EmptyState icon={FileText} title="Nenhum documento encontrado para essa busca." />
        </FadeIn>
      )}

      {expiring.length > 0 && (
        <FadeIn delay={0.08}>
          <div className="flex flex-col gap-2">
            {expiring.map((doc) => (
              <InsightCard
                key={doc.id}
                icon={AlertTriangle}
                accent="red"
                title={`${doc.title} vence em breve`}
                description={doc.expiresAt ? `Válido até ${formatDate(doc.expiresAt)}` : undefined}
              />
            ))}
          </div>
        </FadeIn>
      )}

      {pinned.length > 0 && (
        <FadeIn delay={0.1}>
          <div className="flex flex-col gap-3">
            <SectionHeader title="Favoritos" meta={`${pinned.length}`} />
            <div className="flex flex-col gap-2">{pinned.map((doc) => renderDocCard(doc))}</div>
          </div>
        </FadeIn>
      )}

      {categories.map((category, categoryIndex) => (
        <FadeIn key={category} delay={0.05 * (categoryIndex + 3)}>
          <div className="flex flex-col gap-3">
            <SectionHeader title={category} />
            <div className="flex flex-col gap-2">
              {filtered.filter((doc) => doc.category === category).map((doc) => renderDocCard(doc))}
            </div>
          </div>
        </FadeIn>
      ))}
    </div>
  );
}
