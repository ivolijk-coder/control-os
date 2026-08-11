'use client';

import * as React from 'react';
import type { FinanceCategory } from '@control-os/types';
import { BriefcaseBusiness, HeartPulse, House, ShoppingBasket, Tag, TrendingUp, WalletCards, type LucideIcon } from 'lucide-react';

type CategoryKind = 'receita' | 'despesa';

const CATEGORY_COLORS = ['#6366F1', '#0EA5E9', '#10B981', '#F97316', '#EF4444', '#EAB308', '#8B5CF6'];
const CATEGORY_ICONS = ['tag', 'shopping-basket', 'wallet-cards', 'heart-pulse', 'briefcase', 'house', 'trending-up'] as const;
const ICON_COMPONENTS: Record<string, LucideIcon> = {
  tag: Tag,
  'shopping-basket': ShoppingBasket,
  'wallet-cards': WalletCards,
  'heart-pulse': HeartPulse,
  briefcase: BriefcaseBusiness,
  house: House,
  'trending-up': TrendingUp,
};

function CategoryGlyph({ icon, color }: Pick<FinanceCategory, 'icon' | 'color'>) {
  const Icon = ICON_COMPONENTS[icon] ?? Tag;
  return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tint/[0.06]" style={{ color }}><Icon size={17} strokeWidth={1.9} /></span>;
}

export default function FinanceCategoriesPage() {
  const [categories, setCategories] = React.useState<FinanceCategory[]>([]);
  const [name, setName] = React.useState('');
  const [kind, setKind] = React.useState<CategoryKind>('despesa');
  const [color, setColor] = React.useState(CATEGORY_COLORS[0]);
  const [icon, setIcon] = React.useState<string>('tag');
  const [editing, setEditing] = React.useState<FinanceCategory | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editColor, setEditColor] = React.useState(CATEGORY_COLORS[0]);
  const [editIcon, setEditIcon] = React.useState<string>('tag');
  const [editFavorite, setEditFavorite] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const response = await fetch('/api/finance/categories?includeArchived=true');
    const payload = await response.json().catch(() => undefined);
    if (response.ok) setCategories(payload.categories ?? []);
    else setNotice(payload?.message ?? 'Não foi possível carregar as categorias.');
    setLoading(false);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function createCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const response = await fetch('/api/finance/categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, kind, color, icon }),
    });
    const payload = await response.json().catch(() => undefined);
    setSaving(false);
    setNotice(payload?.message ?? (response.ok ? 'Categoria criada.' : 'Não foi possível criar a categoria.'));
    if (response.ok) { setName(''); setColor(CATEGORY_COLORS[0]); setIcon('tag'); await load(); }
  }

  function startEditing(category: FinanceCategory) {
    setEditing(category);
    setEditName(category.name);
    setEditColor(category.color);
    setEditIcon(category.icon);
    setEditFavorite(category.isFavorite);
  }

  async function updateCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !editName.trim()) return;
    setSaving(true);
    const response = await fetch('/api/finance/categories', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editing.id, action: 'update', name: editName, color: editColor, icon: editIcon, isFavorite: editFavorite }),
    });
    const payload = await response.json().catch(() => undefined);
    setSaving(false);
    setNotice(payload?.message ?? (response.ok ? 'Categoria atualizada.' : 'Não foi possível atualizar a categoria.'));
    if (response.ok) { setEditing(null); await load(); }
  }

  async function changeStatus(category: FinanceCategory, action: 'archive' | 'restore') {
    if (category.isDefault) return;
    const response = await fetch('/api/finance/categories', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: category.id, action }),
    });
    const payload = await response.json().catch(() => undefined);
    setNotice(payload?.message ?? 'Não foi possível atualizar a categoria.');
    if (response.ok) await load();
  }

  async function toggleFavorite(category: FinanceCategory) {
    if (category.isDefault) return;
    const response = await fetch('/api/finance/categories', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: category.id, action: 'update', isFavorite: !category.isFavorite }),
    });
    const payload = await response.json().catch(() => undefined);
    setNotice(payload?.message ?? 'Não foi possível atualizar a categoria.');
    if (response.ok) await load();
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-5 py-8 sm:px-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Financeiro</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">Categorias</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">Organize receitas e despesas. Arquivar preserva todos os lançamentos já registrados.</p>
      </header>

      <section className="rounded-2xl border border-tint/[0.09] bg-tint/[0.035] p-5 shadow-sm">
        <h2 className="text-base font-semibold text-text-primary">Nova categoria</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_155px_auto]" onSubmit={createCategory}>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Assinaturas" maxLength={80} className="h-11 rounded-xl border border-tint/[0.1] bg-tint/[0.03] px-3 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-cyan-400/60" />
          <select value={kind} onChange={(event) => setKind(event.target.value as CategoryKind)} className="h-11 rounded-xl border border-tint/[0.1] bg-tint/[0.03] px-3 text-sm text-text-primary outline-none focus:border-cyan-400/60">
            <option value="despesa">Despesa</option><option value="receita">Receita</option>
          </select>
          <select value={icon} onChange={(event) => setIcon(event.target.value)} aria-label="Ícone da categoria" className="h-11 rounded-xl border border-tint/[0.1] bg-tint/[0.03] px-3 text-sm text-text-primary outline-none focus:border-cyan-400/60">
            {CATEGORY_ICONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <button disabled={saving} className="h-11 rounded-xl bg-cyan-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50">{saving ? 'Salvando...' : 'Adicionar'}</button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Cor da categoria">
          {CATEGORY_COLORS.map((option) => <button key={option} type="button" onClick={() => setColor(option)} aria-label={`Usar cor ${option}`} className={`h-6 w-6 rounded-full border-2 ${color === option ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: option }} />)}
        </div>
        {notice && <p className="mt-4 text-sm text-text-secondary" role="status">{notice}</p>}
      </section>

      {editing && <section className="rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.035] p-5">
        <div className="flex items-start justify-between gap-4"><div><h2 className="text-base font-semibold text-text-primary">Editar categoria</h2><p className="mt-1 text-sm text-text-secondary">O tipo não muda para preservar a consistência das movimentações.</p></div><button type="button" onClick={() => setEditing(null)} className="text-sm text-text-secondary hover:text-text-primary">Cancelar</button></div>
        <form className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_155px_auto]" onSubmit={updateCategory}>
          <input value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={80} className="h-11 rounded-xl border border-tint/[0.1] bg-tint/[0.03] px-3 text-sm text-text-primary outline-none focus:border-cyan-400/60" />
          <select value={editIcon} onChange={(event) => setEditIcon(event.target.value)} aria-label="Ícone da categoria" className="h-11 rounded-xl border border-tint/[0.1] bg-tint/[0.03] px-3 text-sm text-text-primary outline-none focus:border-cyan-400/60">{CATEGORY_ICONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <button disabled={saving} className="h-11 rounded-xl bg-cyan-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50">Salvar</button>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-4"><div className="flex flex-wrap gap-2" aria-label="Cor da categoria">{CATEGORY_COLORS.map((option) => <button key={option} type="button" onClick={() => setEditColor(option)} aria-label={`Usar cor ${option}`} className={`h-6 w-6 rounded-full border-2 ${editColor === option ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: option }} />)}</div><label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={editFavorite} onChange={(event) => setEditFavorite(event.target.checked)} /> Categoria favorita</label></div>
      </section>}

      <section className="overflow-hidden rounded-2xl border border-tint/[0.09] bg-tint/[0.025]">
        <div className="flex items-center justify-between border-b border-tint/[0.08] px-5 py-4"><h2 className="font-semibold text-text-primary">Seu catálogo</h2><span className="text-sm text-text-tertiary">{categories.filter((category) => category.status === 'ativa').length} ativas</span></div>
        {loading ? <p className="px-5 py-8 text-sm text-text-secondary">Carregando categorias...</p> : <ul className="divide-y divide-tint/[0.07]">
          {categories.map((category) => <li key={category.id} className="flex items-center gap-3 px-5 py-3.5">
            <CategoryGlyph icon={category.icon} color={category.color} />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-text-primary">{category.isFavorite ? '★ ' : ''}{category.name}</p><p className="text-xs text-text-tertiary">{category.kind === 'receita' ? 'Receita' : 'Despesa'}{category.isDefault ? ' · padrão do sistema' : category.status === 'arquivada' ? ' · arquivada' : ''}</p></div>
            {!category.isDefault && <div className="flex items-center gap-1"><button type="button" onClick={() => void toggleFavorite(category)} className="rounded-lg px-2 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-tint/[0.07] hover:text-text-primary" aria-label={category.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}>{category.isFavorite ? '★' : '☆'}</button><button type="button" onClick={() => startEditing(category)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-tint/[0.07] hover:text-text-primary">Editar</button><button type="button" onClick={() => void changeStatus(category, category.status === 'ativa' ? 'archive' : 'restore')} className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-tint/[0.07] hover:text-text-primary">{category.status === 'ativa' ? 'Arquivar' : 'Restaurar'}</button></div>}
          </li>)}
        </ul>}
      </section>
    </main>
  );
}
