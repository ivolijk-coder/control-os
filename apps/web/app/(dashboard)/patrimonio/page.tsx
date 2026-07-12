'use client';

import { FadeIn } from '@/components/dashboard/fade-in';
import { GlassCard } from '@/components/ui/glass-card';
import { ICON_MAP } from '@/components/layout/icon-map';
import { useDataStore } from '@/lib/data-store';
import { formatCurrency } from '@/lib/utils';

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(date)
  );
}

/**
 * Patrimônio — módulo pessoal (CONTROL OS — Sistema Operacional Pessoal).
 *
 * Bens com valor estimado, categoria e garantia. Lê `useDataStore.assets`
 * — mesmo padrão dos outros módulos novos desta etapa (dado próprio,
 * mockado, arquitetura pronta pra Nova criar/consultar por conversa numa
 * fase futura).
 */
export default function PatrimonioPage() {
  const assets = useDataStore((state) => state.assets);
  const totalValue = assets.reduce((sum, asset) => sum + asset.estimatedValue, 0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text-primary">Patrimônio</h1>
          <span className="text-xs text-text-tertiary">{assets.length} bens</span>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <GlassCard interactive={false} glow="purple" className="p-5">
          <p className="text-xs text-text-tertiary">Valor total estimado</p>
          <p className="mt-1 text-xl font-semibold text-text-primary">{formatCurrency(totalValue)}</p>
        </GlassCard>
      </FadeIn>

      {assets.length === 0 && (
        <FadeIn delay={0.1}>
          <GlassCard interactive={false} className="p-8 text-center text-sm text-text-secondary">
            Nenhum bem registrado ainda.
          </GlassCard>
        </FadeIn>
      )}

      <div className="flex flex-col gap-2">
        {assets.map((asset, index) => (
          <FadeIn key={asset.id} delay={0.05 * (index + 1)}>
            <GlassCard interactive={false} className="p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-text-secondary">
                  <ICON_MAP.Landmark className="h-4 w-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate text-sm text-text-primary">{asset.name}</p>
                  <p className="text-xs text-text-tertiary">
                    {asset.category}
                    {asset.purchaseDate ? ` · Adquirido em ${formatDate(asset.purchaseDate)}` : ''}
                    {asset.warrantyUntil ? ` · Garantia até ${formatDate(asset.warrantyUntil)}` : ''}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm text-text-primary">
                  {formatCurrency(asset.estimatedValue)}
                </span>
              </div>
            </GlassCard>
          </FadeIn>
        ))}
      </div>
    </div>
  );
}
