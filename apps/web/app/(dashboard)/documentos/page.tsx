'use client';

import { Badge } from '@control-os/ui';
import { FadeIn } from '@/components/dashboard/fade-in';
import { GlassCard } from '@/components/ui/glass-card';
import { ICON_MAP } from '@/components/layout/icon-map';
import { useDataStore } from '@/lib/data-store';

const EXPIRY_WARNING_DAYS = 90;

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(date)
  );
}

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/**
 * Documentos — módulo pessoal (CONTROL OS — Sistema Operacional Pessoal).
 *
 * Agrupado por categoria (CNH, RG, CPF, Passaporte, Garantias, Notas
 * fiscais, Contratos...). Sem upload real de arquivo nesta fase — só
 * metadados (título, categoria, validade); guardar o arquivo em si depende
 * de storage real (Supabase/Drive), fora do escopo desta etapa (arquitetura
 * + mock, sem integração externa).
 */
export default function DocumentosPage() {
  const documents = useDataStore((state) => state.documents);

  const categories = Array.from(new Set(documents.map((doc) => doc.category)));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text-primary">Documentos</h1>
          <span className="text-xs text-text-tertiary">{documents.length} no total</span>
        </div>
      </FadeIn>

      {documents.length === 0 && (
        <FadeIn delay={0.05}>
          <GlassCard interactive={false} className="p-8 text-center text-sm text-text-secondary">
            Nenhum documento ainda.
          </GlassCard>
        </FadeIn>
      )}

      {categories.map((category, categoryIndex) => (
        <FadeIn key={category} delay={0.05 * (categoryIndex + 1)}>
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-text-primary">{category}</h2>
            <div className="flex flex-col gap-2">
              {documents
                .filter((doc) => doc.category === category)
                .map((doc) => {
                  const expiringSoon = doc.expiresAt ? daysUntil(doc.expiresAt) <= EXPIRY_WARNING_DAYS : false;
                  return (
                    <GlassCard key={doc.id} interactive={false} className="p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-text-secondary">
                          <ICON_MAP.FileText className="h-4 w-4" />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <p className="truncate text-sm text-text-primary">{doc.title}</p>
                          <p className="text-xs text-text-tertiary">
                            Adicionado em {formatDate(doc.addedAt)}
                            {doc.expiresAt ? ` · Válido até ${formatDate(doc.expiresAt)}` : ''}
                          </p>
                        </div>
                        {expiringSoon && (
                          <Badge variant="red" className="shrink-0">
                            Vence em breve
                          </Badge>
                        )}
                      </div>
                    </GlassCard>
                  );
                })}
            </div>
          </div>
        </FadeIn>
      ))}
    </div>
  );
}
