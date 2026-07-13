'use client';

import { Car, Home as HomeIcon, Landmark, LineChart, Cpu } from 'lucide-react';
import { FadeIn } from '@/components/dashboard/fade-in';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/dashboard/section-header';
import { DashboardCard } from '@/components/dashboard/dashboard-card';
import { ChartCard } from '@/components/dashboard/chart-card';
import { MiniDonutChart, MiniSparkline, type ChartAccent } from '@/components/dashboard/mini-charts';
import { useDataStore } from '@/lib/data-store';
import { formatCurrency } from '@/lib/utils';

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
}

/**
 * Agrupa a `category` livre de cada bem (Carro, Casa, MacBook...) num dos 4
 * grandes grupos pedidos — mapa fixo, sem inventar categoria que o bem não
 * tem. Bens fora desses 4 grupos caem em "Outros" (não somem da soma total).
 */
const GROUP_BY_CATEGORY: Record<string, { group: string; icon: typeof Car; accent: ChartAccent }> = {
  Carro: { group: 'Veículos', icon: Car, accent: 'blue' },
  Moto: { group: 'Veículos', icon: Car, accent: 'blue' },
  Casa: { group: 'Imóveis', icon: HomeIcon, accent: 'purple' },
  Apartamento: { group: 'Imóveis', icon: HomeIcon, accent: 'purple' },
  Computador: { group: 'Tecnologia', icon: Cpu, accent: 'green' },
  Celular: { group: 'Tecnologia', icon: Cpu, accent: 'green' },
  Notebook: { group: 'Tecnologia', icon: Cpu, accent: 'green' },
  Investimento: { group: 'Investimentos', icon: LineChart, accent: 'red' },
};

type AssetGroup = { group: string; icon: typeof Car; accent: ChartAccent };

const FALLBACK_GROUP: AssetGroup = { group: 'Outros', icon: Landmark, accent: 'blue' };

function groupFor(category: string): AssetGroup {
  return GROUP_BY_CATEGORY[category] ?? FALLBACK_GROUP;
}

/**
 * Patrimônio — módulo premium (CONTROL OS — Etapa 10B).
 *
 * Continua lendo só `useDataStore.assets`. "Evolução" usa `purchaseDate` +
 * `estimatedValue` (os únicos campos temporais que o dado tem) pra desenhar
 * o patrimônio acumulado por data de aquisição — não é valor de mercado ao
 * longo do tempo (não há histórico de reavaliação), é honestamente "quando
 * cada bem entrou e quanto valia então".
 */
export default function PatrimonioPage() {
  const assets = useDataStore((state) => state.assets);
  const totalValue = assets.reduce((sum, asset) => sum + asset.estimatedValue, 0);

  const groupTotals = new Map<string, number>();
  for (const asset of assets) {
    const { group } = groupFor(asset.category);
    groupTotals.set(group, (groupTotals.get(group) ?? 0) + asset.estimatedValue);
  }
  const distribution = Array.from(groupTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([group, value]): { label: string; value: number; accent: ChartAccent } => {
      const sample = assets.find((asset) => groupFor(asset.category).group === group);
      return { label: group, value, accent: sample ? groupFor(sample.category).accent : FALLBACK_GROUP.accent };
    });

  const withPurchaseDate = [...assets]
    .filter((asset) => asset.purchaseDate)
    .sort((a, b) => new Date(a.purchaseDate ?? 0).getTime() - new Date(b.purchaseDate ?? 0).getTime());
  const evolutionValues = withPurchaseDate.reduce<number[]>((acc, asset) => {
    const previous = acc.length > 0 ? acc[acc.length - 1] ?? 0 : 0;
    acc.push(previous + asset.estimatedValue);
    return acc;
  }, []);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <SectionHeader level="page" title="Patrimônio" meta={`${assets.length} bens`} />
      </FadeIn>

      {assets.length === 0 ? (
        <FadeIn delay={0.05}>
          <EmptyState icon={Landmark} title="Nenhum bem registrado ainda." />
        </FadeIn>
      ) : (
        <>
          <FadeIn delay={0.05}>
            <DashboardCard label="Valor total estimado" value={formatCurrency(totalValue)} accent="purple" />
          </FadeIn>

          <FadeIn delay={0.08}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Distribuição" description="Por categoria">
                <MiniDonutChart data={distribution} centerValue={formatCurrency(totalValue)} centerLabel="Total" />
              </ChartCard>
              <ChartCard title="Evolução" description="Patrimônio acumulado por data de aquisição">
                <MiniSparkline values={evolutionValues} accent="purple" />
              </ChartCard>
            </div>
          </FadeIn>

          <FadeIn delay={0.11}>
            <div className="flex flex-col gap-3">
              <SectionHeader title="Bens" />
              <div className="flex flex-col gap-2">
                {assets.map((asset) => {
                  const { icon: Icon, accent } = groupFor(asset.category);
                  return (
                    <div
                      key={asset.id}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-card/60 p-4 shadow-e2 backdrop-blur-sm"
                    >
                      <span
                        className={
                          accent === 'blue'
                            ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-blue/15 text-accent-blue'
                            : accent === 'purple'
                              ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-purple/15 text-accent-purple'
                              : accent === 'green'
                                ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-green/15 text-accent-green'
                                : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-red/15 text-accent-red'
                        }
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <p className="truncate text-sm text-text-primary">{asset.name}</p>
                        <p className="text-xs text-text-tertiary">
                          {asset.category}
                          {asset.purchaseDate ? ` · Adquirido em ${formatDate(asset.purchaseDate)}` : ''}
                          {asset.warrantyUntil ? ` · Garantia até ${formatDate(asset.warrantyUntil)}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-sm text-text-primary">{formatCurrency(asset.estimatedValue)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </FadeIn>
        </>
      )}
    </div>
  );
}
