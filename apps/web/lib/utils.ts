import type { FinanceEntry } from '@control-os/types';

export { cn } from '@control-os/utils';

/**
 * Sinal (+1/-1) de um lançamento sobre o saldo/patrimônio total — mesma
 * convenção de `signedAmount`/`signedGroupTotal` em
 * `services/repositories/finance` (Fase 7): receita soma, despesa
 * subtrai, transferência soma ou subtrai dependendo da perna
 * (`transferDirection`). Compartilhado entre `dashboard/page.tsx` e
 * `financeiro/page.tsx` — as duas leem o mesmo `useDataStore.financeEntries`
 * pra somar saldo acumulado/fluxo de caixa; sem esta função, cada página
 * repetiria (e podia divergir) o mesmo ternário `type === 'receita' ?
 * amount : -amount`, que trata errado qualquer lançamento que não seja
 * receita/despesa (hoje só existe em teoria — nenhum `addFinanceEntry`
 * grava `'transferencia'` em `useDataStore` ainda — mas o tipo já permite,
 * então a conta precisa estar certa antes que o primeiro lançamento desse
 * tipo apareça aqui).
 */
export function financeEntrySign(entry: Pick<FinanceEntry, 'type' | 'transferDirection'>): 1 | -1 {
  if (entry.type === 'receita') return 1;
  if (entry.type === 'despesa') return -1;
  return entry.transferDirection === 'entrada' ? 1 : -1;
}

/** Formata um valor numérico em moeda BRL. Usado nos widgets financeiros do Dashboard. */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

/** Formata uma data relativa curta (ex: "há 2h", "ontem"). Usado na Timeline. */
export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin}min`;

  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours}h`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return 'ontem';
  if (diffDays < 7) return `há ${diffDays}d`;

  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date);
}

/** Retorna as iniciais de um nome, usadas em avatares de fallback. */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Converte `#rrggbb` em `rgba(r, g, b, alpha)`. Usado pelos "Hero Objects"
 * da NOVA/LEGENDARY (`nova-ring-object.tsx`, `legendary-crystal-object.tsx`)
 * — antes vivia duplicado como helper local em `nova-ring-object.tsx`;
 * movido pra cá quando `legendary-crystal-object.tsx` também passou a
 * precisar dele, pra nunca ter duas cópias divergentes da mesma conversão.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.substring(0, 2), 16);
  const g = parseInt(value.substring(2, 4), 16);
  const b = parseInt(value.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
